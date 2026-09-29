import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

/**
 * Signup uses the SAME Supabase Auth configuration already running in
 * production (`auth.users`). This is not a second auth system — it is the
 * existing `signUp()` call the platform already supports at the database
 * level, where `lawyer_profiles` carries an owner-insert policy keyed to
 * `auth.uid()`. That note belongs here, in the code, and not on the screen:
 * the old page printed it to the user.
 */
export const metadata: Metadata = {
  title: "إنشاء حساب",
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  const locale = await getLocale();

  return (
    <AuthShell locale={locale}>
      <Suspense fallback={null}>
        <AuthForm locale={locale} mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
