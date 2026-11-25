import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the signup confirmation email brings a new lawyer back to.
 *
 * Supabase has already confirmed the email by the time it redirects here with
 * `?code=…`. Exchanging the code signs the lawyer in, but only works in the
 * same browser that signed up (the PKCE verifier lives in its cookies). If it
 * fails — a different browser, an expired link — the account is still
 * confirmed, so send them to /login with a short notice instead of an error.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/workspace";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const login = new URL("/login", origin);
  // Supabase adds ?error=… when the link itself was bad (expired, reused):
  // then the email is NOT confirmed, so no «confirmed» notice.
  if (!searchParams.get("error")) login.searchParams.set("confirmed", "1");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
