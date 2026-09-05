"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Uses the SAME Supabase Auth configuration already running in
    // production (auth.users). This does not create a second auth
    // system — it is the existing signUp() call the platform already
    // supports at the database level (lawyer_profiles has an
    // owner_insert policy keyed to auth.uid()).
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="mb-3 text-xl font-semibold">تحقق من بريدك الإلكتروني</h1>
        <p className="text-sm text-neutral-500">
          Check your email to confirm your account before logging in — this uses whatever
          confirmation setting is already configured for Makuria&apos;s Supabase Auth (not modified
          by this staging build).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-xl font-semibold">إنشاء حساب محامٍ / Create a lawyer account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm">البريد الإلكتروني / Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">كلمة المرور / Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          style={{ background: "var(--mk-gold)" }}
        >
          {loading ? "..." : "إنشاء حساب / Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-500">
        لديك حساب؟{" "}
        <Link href="/login" className="text-[var(--mk-gold)] hover:underline">
          تسجيل الدخول / Log in
        </Link>
      </p>
    </div>
  );
}
