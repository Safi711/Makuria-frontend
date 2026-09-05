import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";

export default async function PrincipleDetailPage(props: PageProps<"/principles/[slug]">) {
  const { slug } = await props.params;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: principle } = await supabase
    .from("legal_principles")
    .select("id, title_ar, title_en, summary_ar, summary_en, category, first_known_year, current_status")
    .eq("slug", slug)
    .maybeSingle();

  if (!principle) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">
        {locale === "ar" ? principle.title_ar : principle.title_en || principle.title_ar}
      </h1>
      <p className="mb-8 text-sm text-neutral-500">
        {principle.category} {principle.first_known_year ? `· ${principle.first_known_year}` : ""}
      </p>
      <p className="text-sm leading-relaxed">
        {locale === "ar" ? principle.summary_ar : principle.summary_en || principle.summary_ar}
      </p>
    </div>
  );
}
