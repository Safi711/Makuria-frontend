import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { SITE_URL, clampDescription } from "@/lib/site";

export async function generateMetadata(
  props: PageProps<"/principles/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("legal_principles")
    .select("title_ar, title_en, summary_ar, category, first_known_year")
    .eq("slug", slug)
    .maybeSingle();

  if (!p) return { title: "مبدأ غير موجود", robots: { index: false, follow: true } };

  const title = p.title_ar || p.title_en || slug;
  const facts = [p.category, p.first_known_year ? `منذ ${p.first_known_year}` : null]
    .filter(Boolean)
    .join(" · ");
  const description = clampDescription(
    p.summary_ar ? `${p.summary_ar}${facts ? ` — ${facts}` : ""}` : `مبدأ قانوني سوداني. ${facts}`
  );

  return {
    title,
    description,
    alternates: { canonical: `/principles/${slug}` },
    openGraph: { type: "article", url: `${SITE_URL}/principles/${slug}`, title, description },
  };
}

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
