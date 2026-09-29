import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

/**
 * A server component now, so the page can read the visitor's locale — the old
 * version was a client component and therefore could not, which is why its
 * labels were hard-coded in two languages at once.
 *
 * `AuthForm` reads `?next=` through `useSearchParams`, so it sits inside a
 * Suspense boundary; without one, Next refuses to prerender the route.
 */
export const metadata: Metadata = {
  title: "تسجيل الدخول",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const locale = await getLocale();

  return (
    <AuthShell locale={locale}>
      <Suspense fallback={null}>
        <AuthForm locale={locale} mode="login" />
      </Suspense>
    </AuthShell>
  );
}
