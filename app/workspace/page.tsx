import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { WorkspaceNav } from "@/components/WorkspaceNav";

export default async function WorkspacePage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();

  // owner_select_lawyer_profiles already restricts this to the caller's
  // own row — a missing row just means the profile hasn't been created
  // yet, shown honestly rather than invented.
  const { data: profile } = await supabase
    .from("lawyer_profiles")
    .select("id, full_name, created_at")
    .eq("id", userData.user?.id ?? "")
    .maybeSingle();

  // Matters already exist as a schema (Phase 1) but Case Mapper itself
  // is not built in Phase 0.6 — this is a real, honest count, not a
  // feature.
  const { count: mattersCount } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row">
      <WorkspaceNav locale={locale} />
      <div className="flex-1">
        <h1 className="mb-1 text-2xl font-bold">{t(locale, "workspaceWelcome")}</h1>
        <p className="mb-8 text-sm text-neutral-500">
          {userData.user?.email}
          {profile?.full_name ? ` · ${profile.full_name}` : ""}
        </p>

        <div className="rounded-lg border p-6" style={{ borderColor: "var(--mk-border)" }}>
          <p className="text-sm font-medium">
            {locale === "ar" ? "الملفات القضائية" : "Matters"}: {mattersCount ?? 0}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {mattersCount === 0 || mattersCount === null
              ? t(locale, "workspaceEmpty")
              : locale === "ar"
                ? "Case Mapper لعرض وإدارة هذه الملفات لم يُبنَ بعد في هذه المرحلة."
                : "The Case Mapper UI to view/manage these matters is not built in this phase yet."}
          </p>
        </div>
      </div>
    </div>
  );
}
