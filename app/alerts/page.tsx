import { getLocale } from "@/lib/i18n-server";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { ComingSoon } from "@/components/ComingSoon";

export default async function AlertsPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row">
      <WorkspaceNav locale={locale} />
      <div className="flex-1">
        <ComingSoon locale={locale} moduleName={locale === "ar" ? "التنبيهات" : "Alerts"} />
      </div>
    </div>
  );
}
