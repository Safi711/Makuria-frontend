"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border px-2.5 py-1 text-xs font-medium hover:border-[var(--mk-gold)]"
      style={{ borderColor: "var(--mk-border)" }}
    >
      {t(locale, "navLogout")}
    </button>
  );
}
