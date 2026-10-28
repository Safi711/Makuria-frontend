import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { AdvisorPage } from "@/components/case-mapper/AdvisorPage";
import type { CaseMapResult } from "@/lib/case-mapper/analyze";

/**
 * A shared Abu Rannat analysis (/abu-rannat/s/<token>), created only when a
 * visitor pressed «مشاركة التحليل». Shows the saved result exactly as it was;
 * no new analysis, no model call. Never indexed — it carries a user's facts.
 */
export const metadata: Metadata = {
  title: "تحليل مُشارَك — أبو رنات",
  robots: { index: false, follow: false },
};

export default async function SharedAnalysisRoute(props: PageProps<"/abu-rannat/s/[token]">) {
  const { token } = await props.params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(token)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abu_rannat_share_get", { p_token: token });
  if (error || !data) notFound();

  const locale = await getLocale();
  return <AdvisorPage locale={locale} sharedResult={data as CaseMapResult} />;
}
