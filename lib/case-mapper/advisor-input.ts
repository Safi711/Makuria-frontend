import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * Where Abu Rannat's input lives between the form post and the render.
 *
 * Until 2026-10-27 the form was a GET form and the facts travelled in the
 * address bar (?facts=…), which put them in browser history, server logs and
 * analytics. Safi chose option (ب) on 2026-10-27: facts are POSTed to a Server
 * Action, kept for a few minutes in an httpOnly cookie scoped to /abu-rannat,
 * and never appear in a URL. Sharing is now an explicit act (see share.ts).
 *
 * The cookie is compressed and split into chunks because a single cookie is
 * capped near 4 KB and Arabic text is two bytes a character.
 */

export type AdvisorInput = {
  facts: string;
  caseType: string;
  court: string;
  jurisdiction: string;
  incidentDate: string;
  keywords: string;
};

export const ADVISOR_COOKIE = "ar_in";
export const ADVISOR_COOKIE_PATH = "/abu-rannat";
/** Ten minutes: long enough to read and share, short enough not to linger. */
export const ADVISOR_COOKIE_MAX_AGE = 600;
/** Hard cap on the facts box. Generous for a narrative of facts. */
export const MAX_FACTS_CHARS = 5000;

const CHUNK_SIZE = 3500;
const MAX_CHUNKS = 5;

const FIELDS = ["caseType", "court", "jurisdiction", "incidentDate", "keywords"] as const;

export function inputFromFormData(formData: FormData): AdvisorInput {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    facts: get("facts").slice(0, MAX_FACTS_CHARS),
    caseType: get("case_type").slice(0, 200),
    court: get("court").slice(0, 200),
    jurisdiction: get("jurisdiction").slice(0, 200),
    incidentDate: get("incident_date").slice(0, 40),
    keywords: get("keywords").slice(0, 500),
  };
}

export function inputFromLegacyParams(
  sp: Record<string, string | string[] | undefined>,
): AdvisorInput | null {
  const s = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
  if (s(sp.submitted) !== "1") return null;
  return {
    facts: s(sp.facts),
    caseType: s(sp.case_type),
    court: s(sp.court),
    jurisdiction: s(sp.jurisdiction),
    incidentDate: s(sp.incident_date),
    keywords: s(sp.keywords),
  };
}

/** Returns the chunk values to store, or null if the input is too large. */
export function encodeInput(input: AdvisorInput): string[] | null {
  const packed = deflateRawSync(Buffer.from(JSON.stringify(input), "utf8")).toString("base64url");
  const chunks: string[] = [];
  for (let i = 0; i < packed.length; i += CHUNK_SIZE) chunks.push(packed.slice(i, i + CHUNK_SIZE));
  return chunks.length <= MAX_CHUNKS ? chunks : null;
}

export function decodeInput(
  get: (name: string) => string | undefined,
): AdvisorInput | null {
  const count = Number(get(`${ADVISOR_COOKIE}.n`) ?? "0");
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
  let packed = "";
  for (let i = 0; i < count; i++) {
    const part = get(`${ADVISOR_COOKIE}.${i}`);
    if (!part) return null;
    packed += part;
  }
  try {
    const obj = JSON.parse(inflateRawSync(Buffer.from(packed, "base64url")).toString("utf8"));
    if (typeof obj?.facts !== "string") return null;
    const out: AdvisorInput = { facts: obj.facts.slice(0, MAX_FACTS_CHARS), caseType: "", court: "", jurisdiction: "", incidentDate: "", keywords: "" };
    for (const f of FIELDS) if (typeof obj[f] === "string") out[f] = obj[f];
    return out;
  } catch {
    return null;
  }
}

export const MAX_INPUT_CHUNKS = MAX_CHUNKS;
