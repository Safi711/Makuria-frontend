"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { analyzeCase } from "@/lib/case-mapper/analyze";
import { redactPII } from "@/lib/case-mapper/redact-pii.mjs";
import {
  ADVISOR_COOKIE,
  ADVISOR_COOKIE_MAX_AGE,
  ADVISOR_COOKIE_PATH,
  MAX_INPUT_CHUNKS,
  decodeInput,
  encodeInput,
  inputFromFormData,
} from "@/lib/case-mapper/advisor-input";

const cookieOpts = {
  path: ADVISOR_COOKIE_PATH,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: ADVISOR_COOKIE_MAX_AGE,
};

/**
 * The facts form posts here. The facts go into a short-lived httpOnly cookie
 * (never the URL); setting the cookie makes Next.js re-render /abu-rannat in
 * the same round trip, and the page reads the input back from the cookie.
 */
export async function submitAnalysis(formData: FormData): Promise<void> {
  const input = inputFromFormData(formData);
  const store = await cookies();
  // Over-long input is cut down until it fits rather than rejected.
  let chunks = encodeInput(input);
  while (!chunks && input.facts.length > 500) {
    input.facts = input.facts.slice(0, Math.floor(input.facts.length * 0.8));
    chunks = encodeInput(input);
  }
  if (!chunks) return;
  for (let i = 0; i < MAX_INPUT_CHUNKS; i++) {
    if (i < chunks.length) store.set(`${ADVISOR_COOKIE}.${i}`, chunks[i], cookieOpts);
    else store.delete({ name: `${ADVISOR_COOKIE}.${i}`, path: ADVISOR_COOKIE_PATH });
  }
  store.set(`${ADVISOR_COOKIE}.n`, String(chunks.length), cookieOpts);
}

/** "تحليل جديد": forget the stored input. */
export async function clearAnalysis(): Promise<void> {
  const store = await cookies();
  for (let i = 0; i < MAX_INPUT_CHUNKS; i++) store.delete({ name: `${ADVISOR_COOKIE}.${i}`, path: ADVISOR_COOKIE_PATH });
  store.delete({ name: `${ADVISOR_COOKIE}.n`, path: ADVISOR_COOKIE_PATH });
}

/**
 * Sharing is opt-in. The analysis is recomputed on the server from the
 * stored input (never taken from the browser, so nobody can forge a result
 * under makuria.legal), saved through a SECURITY DEFINER function, and the
 * visitor is sent to the short link. Opening the link reads the saved result;
 * it never calls the model again.
 */
export async function createShareLink(): Promise<void> {
  const store = await cookies();
  const input = decodeInput((n) => store.get(n)?.value);
  if (!input || !input.facts.trim()) redirect("/abu-rannat");

  const supabase = await createClient();
  const result = await analyzeCase(supabase, {
    facts: input.facts,
    caseType: input.caseType || undefined,
    court: input.court || undefined,
    jurisdiction: input.jurisdiction || undefined,
    incidentDate: input.incidentDate || undefined,
    keywords: input.keywords || undefined,
  });

  // The database refuses to save without this server-only secret, so nobody
  // can call the public RPC directly and plant a fake "analysis" under
  // makuria.legal. It must be set in .env.local AND in the hosting settings.
  const secret = process.env.ABU_RANNAT_SHARE_SECRET;
  if (!secret) redirect("/abu-rannat?share_error=1");

  // A share link is public to whoever receives it, so the facts excerpt it
  // carries goes through the same redaction as the copy sent to the model:
  // names, phone/ID numbers and emails become [اسم] / [رقم] / [بريد].
  // (The excerpt is the only field of the result that echoes the facts.)
  const shared = { ...result, factsExcerpt: redactPII(result.factsExcerpt) };

  const token = randomBytes(9).toString("base64url"); // 12 URL-safe chars
  const { error } = await supabase.rpc("abu_rannat_share_create", {
    p_token: token,
    p_result: shared,
    p_secret: secret,
  });
  if (error) redirect("/abu-rannat?share_error=1");
  redirect(`/abu-rannat/s/${token}`);
}
