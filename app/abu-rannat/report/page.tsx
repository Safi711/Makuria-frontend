import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { analyzeCase } from "@/lib/case-mapper/analyze";
import { decodeInput } from "@/lib/case-mapper/advisor-input";
import {
  ReportDocument,
  reportArticleRefs,
  type ReportArticle,
} from "@/components/case-mapper/ReportDocument";

/**
 * /abu-rannat/report — «تقرير بحث قانوني — أبو رنات», ready to save as PDF.
 *
 * Reads the same short-lived httpOnly cookie as /abu-rannat (path-scoped to
 * /abu-rannat, so it reaches this page), so the facts never travel in a URL.
 * The analysis is recomputed here, and every article's full text is read from
 * the database for the report rather than taken from the search excerpt.
 * Nothing is stored. Not indexed.
 */
export const metadata: Metadata = {
  title: "تقرير بحث قانوني — أبو رنات",
  robots: { index: false, follow: false },
};

export default async function AbuRannatReport() {
  const store = await cookies();
  const input = decodeInput((n) => store.get(n)?.value);

  if (!input || !input.facts.trim()) {
    return (
      <div dir="rtl" className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="mb-4">لا يوجد تحليل لعرضه في تقرير. اكتب الوقائع في صفحة أبو رنات أولاً.</p>
        <Link href="/abu-rannat" className="underline">الذهاب إلى أبو رنات</Link>
      </div>
    );
  }

  const supabase = await createClient();
  let result;
  try {
    result = await analyzeCase(supabase, {
      facts: input.facts,
      caseType: input.caseType || undefined,
      court: input.court || undefined,
      jurisdiction: input.jurisdiction || undefined,
      incidentDate: input.incidentDate || undefined,
      keywords: input.keywords || undefined,
    });
  } catch {
    return (
      <div dir="rtl" className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="mb-4">تعذّر إعداد التقرير الآن. حاول مرة أخرى.</p>
        <Link href="/abu-rannat" className="underline">العودة إلى أبو رنات</Link>
      </div>
    );
  }

  // Full article text, read now: the report's "verified" section never relies
  // on the truncated, highlighted search excerpt.
  const refs = reportArticleRefs(result);
  const ids = refs.map((r) => r.a.id);
  const { data: rows } = ids.length
    ? await supabase
        .from("articles")
        .select("id,article_number,title_ar,content_ar,legal_status,status_note_ar,laws(title_ar,source_url)")
        .in("id", ids)
    : { data: [] };
  type Row = {
    id: string; article_number: string | null; title_ar: string | null; content_ar: string | null;
    legal_status: string | null; status_note_ar: string | null;
    laws: { title_ar: string | null; source_url: string | null } | { title_ar: string | null; source_url: string | null }[] | null;
  };
  const byId = new Map(((rows ?? []) as Row[]).map((r) => [r.id, r]));
  const articles: ReportArticle[] = refs.flatMap(({ a, role }) => {
    const r = byId.get(a.id);
    if (!r || !r.content_ar) return [];
    const law = Array.isArray(r.laws) ? r.laws[0] : r.laws;
    return [{
      id: a.id,
      lawTitle: law?.title_ar ?? a.lawTitle ?? "",
      articleNumber: r.article_number,
      titleAr: r.title_ar,
      content: r.content_ar,
      legalStatus: r.legal_status,
      // A card's "for research" override is a role, not a note; keep the
      // article's own note (e.g. «نسخة مرجعية غير رسمية…») when it has one.
      statusNote: r.status_note_ar ?? a.statusNote,
      sourceUrl: law?.source_url ?? a.sourceUrl,
      role,
    }];
  });

  const now = new Date();
  const dateAr = new Intl.DateTimeFormat("ar-SD-u-nu-latn", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Khartoum",
  }).format(now);
  // Same clock as the date shown (Khartoum), so the number and the date agree.
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Khartoum" })
    .format(now).replace(/-/g, "");
  const reportId = `AR-${ymd}-${createHash("sha256").update(input.facts).digest("hex").slice(0, 6).toUpperCase()}`;

  return (
    <div style={{ background: "#e9edf2", padding: "1px 12px" }}>
      <ReportDocument
        facts={input.facts}
        result={result}
        articles={articles}
        reportId={reportId}
        dateAr={dateAr}
      />
    </div>
  );
}
