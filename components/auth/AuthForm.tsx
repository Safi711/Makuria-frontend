"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { t, type Locale } from "@/lib/i18n";

/**
 * Login and signup, one component — because two copies of the same form drift,
 * and the pair that drifted here had already produced a signup page whose
 * success screen shipped a developer's note to the user in English.
 *
 * Four things were fixed along with the visual redesign (2026-09-28):
 *
 * 1. THE STRINGS ARE TRANSLATED. Both pages hard-coded «تسجيل الدخول / Log in»
 *    with the two languages glued together, ignoring the site's locale. Every
 *    other page uses `t(locale, …)`. Now these do too, so the English visitor
 *    gets English and the Arabic visitor gets Arabic.
 *
 * 2. THE ERRORS SPEAK ARABIC. The old form printed Supabase's raw English
 *    string — «Invalid login credentials» — to a Sudanese lawyer. The common
 *    cases are mapped below. An unrecognised error still shows the original
 *    underneath in small type rather than being swallowed, so a real fault can
 *    still be diagnosed.
 *
 * 3. THE `next` PARAMETER CANNOT LEAVE THE SITE. The old code ran
 *    `router.push(searchParams.get("next"))` with no check, so a link like
 *    `/login?next=https://…` would carry a lawyer off this site the moment
 *    they signed in — the exact shape of a phishing link, and one that looks
 *    trustworthy because it really does start at makuria. Only same-origin
 *    paths are accepted now.
 *
 * 4. THE SUCCESS SCREEN IS FOR A USER, NOT A DEVELOPER. What the signup page
 *    used to show, verbatim: "this uses whatever confirmation setting is
 *    already configured for Makuria's Supabase Auth (not modified by this
 *    staging build)".
 */

/** Only same-origin paths. A value that does not start with «/» is an absolute
 * URL to somewhere else, and «//host» is protocol-relative — it leaves the
 * site too, which is why one slash is not enough of a test. */
function safeNext(raw: string | null): string {
  if (!raw) return "/workspace";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/workspace";
  return raw;
}

/** Supabase's English auth errors, mapped to what a person needs to be told.
 * Matching is on a substring because the wording carries variable parts. */
function errorKey(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "authErrInvalid";
  if (m.includes("email not confirmed")) return "authErrNotConfirmed";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "authErrExists";
  if (m.includes("password should be") || m.includes("password is too short"))
    return "authErrWeakPassword";
  if (m.includes("for security purposes") || m.includes("rate limit")) return "authErrRate";
  return null;
}

export function AuthForm({ locale, mode }: { locale: Locale; mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ text: string; raw?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (authError) {
      const key = errorKey(authError.message);
      setError(
        key
          ? { text: t(locale, key) }
          : { text: t(locale, "authErrGeneric"), raw: authError.message }
      );
      return;
    }

    if (isLogin) {
      const next = safeNext(searchParams.get("next"));
      router.push(next);
      router.refresh();
    } else {
      setDone(true);
    }
  }

  const fieldStyle = {
    background: "var(--cm-surface-2)",
    borderColor: "var(--cm-line)",
    color: "var(--cm-text)",
  } as React.CSSProperties;

  if (done) {
    return (
      <>
        <h1 className="mb-2 text-xl font-bold">{t(locale, "authCheckEmailTitle")}</h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--cm-muted)" }}>
          {t(locale, "authCheckEmailBody")}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-bold"
          style={{ background: "var(--mk-gold)", color: "#0A1A2F" }}
        >
          {t(locale, "authGoLogin")}
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-1.5 text-xl font-bold sm:text-2xl">
        {t(locale, isLogin ? "authLoginTitle" : "authSignupTitle")}
      </h1>
      <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--cm-muted)" }}>
        {t(locale, isLogin ? "authLoginSub" : "authSignupSub")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
            {t(locale, "authEmail")}
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--mk-gold)]"
            style={fieldStyle}
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
            {t(locale, "authPassword")}
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--mk-gold)]"
            style={fieldStyle}
          />
          {!isLogin && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--cm-faint)" }}>
              {t(locale, "authPasswordHint")}
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border px-3 py-2.5 text-sm leading-relaxed"
            style={{ borderColor: "#7F2A22", background: "rgba(127,42,34,0.18)", color: "#F3C9C2" }}
          >
            {error.text}
            {error.raw && (
              <span className="mt-1 block text-xs opacity-70" dir="ltr">
                {error.raw}
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-60"
          style={{ background: "var(--mk-gold)", color: "#0A1A2F" }}
        >
          {loading ? t(locale, "authWorking") : t(locale, isLogin ? "authLoginBtn" : "authSignupBtn")}
        </button>
      </form>

      <p className="mt-5 text-sm" style={{ color: "var(--cm-muted)" }}>
        {t(locale, isLogin ? "authNoAccount" : "authHaveAccount")}{" "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="font-medium hover:underline"
          style={{ color: "var(--mk-gold-soft)" }}
        >
          {t(locale, isLogin ? "authGoSignup" : "authGoLogin")}
        </Link>
      </p>
    </>
  );
}
