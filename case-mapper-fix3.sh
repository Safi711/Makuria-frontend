#!/usr/bin/env bash
set -euo pipefail
echo ">> Fix: exclude common Sudanese/Arabic given names (محمد، أحمد، علي...) from extracted legal-issue terms, so precedent matching no longer keys off a party first name"
mkdir -p "$(dirname "lib/case-mapper/analyze.ts")"
cat > "lib/case-mapper/analyze.ts" << 'CMFIX3_EOF'
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Case Mapper Phase 1 — deterministic retrieval over the existing Makuria
 * corpus. No embeddings, no external AI call, nothing invented: every term
 * searched here is either something the lawyer typed (case type, keywords)
 * or a word pulled directly out of their own facts text. Every result
 * returned is a real row from `universal_search` (already deployed,
 * server-side, bounded) or a small field-selected follow-up query.
 *
 * If a term matches nothing in the corpus, that is reported honestly
 * rather than papered over — see EMPTY_AUTHORITY_MESSAGE_AR below.
 */

export const EMPTY_AUTHORITY_MESSAGE_AR =
  "لم يتم العثور على مرجع موثّق في قاعدة مكوريا.";
export const EMPTY_AUTHORITY_MESSAGE_EN =
  "No verified authority was found in the Makuria database.";

export type CaseMapperInput = {
  facts: string;
  caseType?: string;
  court?: string;
  jurisdiction?: string;
  incidentDate?: string;
  keywords?: string;
};

export type AuthorityLevel =
  | "verified" // good_law / verified boolean true
  | "needs_review" // under_review / limited
  | "overruled" // overruled — must never read as good authority
  | "unverified"; // no status recorded

export type RetrievedAuthority = {
  id: string;
  type: "law" | "article";
  title: string;
  lawTitle: string | null;
  articleNumber: string | null;
  excerptHtml: string;
  verified: boolean;
  slug: string | null;
  sourceUrl: string | null;
  matchedTerm: string;
  rank: number;
};

export type RetrievedCase = {
  id: string;
  title: string;
  courtName: string | null;
  year: number | null;
  judgmentDate: string | null;
  citation: string | null;
  caseNumber: string | null;
  principle: string | null;
  excerptHtml: string;
  authority: AuthorityLevel;
  slug: string | null;
  sourceUrl: string | null;
  matchedTerm: string;
  rank: number;
};

export type RetrievedPrinciple = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  slug: string | null;
  matchedTerm: string;
  rank: number;
};

export type IssueLens = {
  term: string;
  origin: "case_type" | "keyword" | "extracted";
  topLaw: RetrievedAuthority | null;
  topCase: RetrievedCase | null;
  topPrinciple: RetrievedPrinciple | null;
};

export type CaseMapResult = {
  factsExcerpt: string;
  factsIsTruncated: boolean;
  issues: IssueLens[];
  laws: RetrievedAuthority[];
  cases: RetrievedCase[];
  principles: RetrievedPrinciple[];
  hasAnyResults: boolean;
};

const MAX_TERMS = 6;
const MAX_EXTRACTED = 5;
const PER_TERM_LIMIT = 6;
const OVERALL_TERM_LIMIT = 18;
const DISPLAY_CAP = 8;

// A short, deliberately conservative Arabic stopword list — only common
// function words. Under-removing is safer than over-removing here, since
// dropping a real legal noun would silently weaken retrieval.
const STOPWORDS = new Set([
  "في", "من", "إلى", "على", "عن", "أن", "إن", "أنه", "أنها", "التي", "الذي",
  "الذين", "و", "أو", "ثم", "قد", "كان", "كانت", "هذا", "هذه", "ذلك", "تلك",
  "لم", "لن", "لا", "ما", "مع", "بين", "عند", "بعد", "قبل", "كل", "بعض",
  "حيث", "حين", "إذا", "كما", "غير", "دون", "إلا", "هو", "هي", "هم", "أنا",
  "نحن", "انت", "انتم", "كانوا", "يكون", "تم", "كذلك", "وقد", "فقد",
]);

// Very common Sudanese/Arabic given names. A party's first name is a weak,
// near-random signal for legal relevance — it mainly just happens to match
// unrelated precedents whose parties share the same common name (e.g. a
// debt dispute pulling in an unrelated case only because both involve
// someone named "محمد"). Excluding these from *extracted* terms keeps the
// extraction focused on actual legal-issue vocabulary; it does not touch
// case type or keywords the lawyer typed in explicitly.
const COMMON_GIVEN_NAMES = new Set([
  "محمد", "أحمد", "احمد", "علي", "عبدالله", "عبدالله", "عبد", "إبراهيم",
  "ابراهيم", "الحسن", "حسن", "حسين", "عمر", "عثمان", "يوسف", "إسماعيل",
  "اسماعيل", "خالد", "عبدالرحمن", "عبدالرحيم", "الطيب", "الفاتح", "مصطفى",
  "مصطفي", "صالح", "آدم", "ادم", "بابكر", "التاج", "عوض", "النور", "نور",
  "عبدالعزيز", "الأمين", "الامين", "بشير", "عادل", "ياسر", "طارق", "كمال",
  "مأمون", "مامون", "فاطمة", "عائشة", "عايشة", "خديجة", "مريم", "زينب",
  "آمنة", "امنة", "حواء", "سارة", "هدى", "إيمان", "ايمان", "سلمى", "نعمات",
  "أسماء", "اسماء", "منى", "سعاد", "نجوى", "سمية", "سميه",
]);

function stripTashkeel(text: string): string {
  return text.replace(/[ً-ٰٟ]/g, "");
}

/** Deterministic keyword extraction: frequency count over the facts text,
 * stopwords and short tokens removed. This is a mechanical word-frequency
 * pass, not legal reasoning — labeled as such everywhere it's shown. */
export function extractTerms(text: string, max = MAX_EXTRACTED): string[] {
  const cleaned = stripTashkeel(text);
  const words = cleaned.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    // Pure numbers (e.g. "500", "000" split out of "500,000") are not
    // legal issues — searching them also just noises up universal_search.
    if (/^[0-9]+$/.test(w)) continue;
    // A party's common given name is not a legal issue either — see
    // COMMON_GIVEN_NAMES above.
    if (COMMON_GIVEN_NAMES.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, max);
}

function splitKeywordsField(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,،\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/** Extractive, position-based "summary" — the leading sentences of what
 * the lawyer typed. No interpretation or inference is added; Phase 1 has
 * no AI summarization pipeline, so nothing is claimed beyond this. */
export function buildFactsExcerpt(
  facts: string,
  maxChars = 480
): { excerpt: string; truncated: boolean } {
  const trimmed = facts.trim();
  if (trimmed.length <= maxChars) return { excerpt: trimmed, truncated: false };
  // Cut on a sentence boundary near the limit where possible.
  const sentenceEnd = /[.!؟?]\s/g;
  let lastGood = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceEnd.exec(trimmed))) {
    if (m.index > maxChars) break;
    lastGood = m.index + 1;
  }
  const cut = lastGood > 200 ? lastGood : maxChars;
  return { excerpt: trimmed.slice(0, cut).trim(), truncated: true };
}

function caseAuthority(row: { verified: boolean | null; authority_status: string | null }): AuthorityLevel {
  const status = row.authority_status;
  if (status === "good_law") return "verified";
  if (status === "overruled") return "overruled";
  if (status === "limited" || status === "under_review") return "needs_review";
  if (row.verified) return "verified";
  return "unverified";
}

type UniversalSearchRow = {
  result_type: string;
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  snippet: string | null;
  identifier: string | null;
  slug: string | null;
  parent_law_id: string | null;
  rank: number;
  headline: string | null;
};

export async function analyzeCase(
  supabase: SupabaseClient,
  input: CaseMapperInput
): Promise<CaseMapResult> {
  const { excerpt, truncated } = buildFactsExcerpt(input.facts);

  // Build the bounded list of search terms: case type + user keywords take
  // priority, then frequency-extracted terms fill remaining slots.
  const terms: { term: string; origin: IssueLens["origin"] }[] = [];
  const seen = new Set<string>();
  const pushTerm = (term: string, origin: IssueLens["origin"]) => {
    const t = term.trim();
    if (!t || seen.has(t) || terms.length >= MAX_TERMS) return;
    seen.add(t);
    terms.push({ term: t, origin });
  };

  if (input.caseType) pushTerm(input.caseType, "case_type");
  for (const kw of splitKeywordsField(input.keywords)) pushTerm(kw, "keyword");
  for (const ex of extractTerms(input.facts)) pushTerm(ex, "extracted");

  // One bounded universal_search call per term (never an unbounded scan,
  // never select=*). Results are merged and deduped by entity id below.
  const perTermResults = await Promise.all(
    terms.map(async ({ term }) => {
      const { data, error } = await supabase.rpc("universal_search", {
        q: term,
        result_types: ["law", "article", "case", "principle"],
        limit_per_type: PER_TERM_LIMIT,
        overall_limit: OVERALL_TERM_LIMIT,
      });
      if (error) return { term, rows: [] as UniversalSearchRow[] };
      return { term, rows: (data ?? []) as UniversalSearchRow[] };
    })
  );

  const lawMap = new Map<string, RetrievedAuthority>();
  const caseHitMap = new Map<string, { row: UniversalSearchRow; term: string }>();
  const principleHitMap = new Map<string, { row: UniversalSearchRow; term: string }>();

  for (const { term, rows } of perTermResults) {
    for (const row of rows) {
      if (row.result_type === "law" || row.result_type === "article") {
        const existing = lawMap.get(row.entity_id);
        if (!existing || row.rank > existing.rank) {
          lawMap.set(row.entity_id, {
            id: row.entity_id,
            type: row.result_type as "law" | "article",
            title: row.title ?? "",
            lawTitle: row.result_type === "article" ? row.subtitle : null,
            articleNumber: row.result_type === "article" ? row.identifier : null,
            excerptHtml: row.headline ?? row.snippet ?? "",
            verified: false, // filled in from a follow-up query below
            slug: row.slug,
            sourceUrl: null,
            matchedTerm: term,
            rank: row.rank,
          });
        }
      } else if (row.result_type === "case") {
        const existing = caseHitMap.get(row.entity_id);
        if (!existing || row.rank > existing.row.rank) {
          caseHitMap.set(row.entity_id, { row, term });
        }
      } else if (row.result_type === "principle") {
        const existing = principleHitMap.get(row.entity_id);
        if (!existing || row.rank > existing.row.rank) {
          principleHitMap.set(row.entity_id, { row, term });
        }
      }
    }
  }

  // Follow-up field-selected queries — never select('*'), bounded to the
  // small candidate id sets gathered above.
  const lawIds = [...lawMap.entries()].filter(([, v]) => v.type === "law").map(([id]) => id);
  const articleIds = [...lawMap.entries()].filter(([, v]) => v.type === "article").map(([id]) => id);
  const caseIds = [...caseHitMap.keys()];
  const principleIds = [...principleHitMap.keys()];

  const [lawsDetail, articlesDetail, casesDetail, principlesDetail] = await Promise.all([
    lawIds.length
      ? supabase.from("laws").select("id, verified, source_url").in("id", lawIds)
      : Promise.resolve({ data: [] as { id: string; verified: boolean | null; source_url: string | null }[] }),
    articleIds.length
      ? supabase.from("articles").select("id, verified, law_id").in("id", articleIds)
      : Promise.resolve({ data: [] as { id: string; verified: boolean | null; law_id: string }[] }),
    caseIds.length
      ? supabase
          .from("cases")
          .select("id, verified, authority_status, court_id, year, judgment_date, case_number, citation_ar, principle_ar, source_url")
          .in("id", caseIds)
      : Promise.resolve({ data: [] as Array<{
          id: string; verified: boolean | null; authority_status: string | null; court_id: string | null;
          year: number | null; judgment_date: string | null; case_number: string | null;
          citation_ar: string | null; principle_ar: string | null; source_url: string | null;
        }> }),
    principleIds.length
      ? supabase.from("legal_principles").select("id, category, summary_ar").in("id", principleIds)
      : Promise.resolve({ data: [] as { id: string; category: string | null; summary_ar: string | null }[] }),
  ]);

  // Laws referenced by articles, for the article's parent law source_url.
  const parentLawIds = [...new Set((articlesDetail.data ?? []).map((a) => a.law_id))];
  const { data: parentLaws } = parentLawIds.length
    ? await supabase.from("laws").select("id, source_url").in("id", parentLawIds)
    : { data: [] as { id: string; source_url: string | null }[] };
  const parentLawSourceById = new Map((parentLaws ?? []).map((l) => [l.id, l.source_url]));

  const lawDetailById = new Map((lawsDetail.data ?? []).map((l) => [l.id, l]));
  const articleDetailById = new Map((articlesDetail.data ?? []).map((a) => [a.id, a]));

  for (const [id, entry] of lawMap) {
    if (entry.type === "law") {
      const d = lawDetailById.get(id);
      entry.verified = Boolean(d?.verified);
      entry.sourceUrl = d?.source_url ?? null;
    } else {
      const d = articleDetailById.get(id);
      entry.verified = Boolean(d?.verified);
      entry.sourceUrl = d ? parentLawSourceById.get(d.law_id) ?? null : null;
    }
  }

  const courtIds = [...new Set((casesDetail.data ?? []).map((c) => c.court_id).filter(Boolean))] as string[];
  const { data: courts } = courtIds.length
    ? await supabase.from("courts").select("id, name_ar").in("id", courtIds)
    : { data: [] as { id: string; name_ar: string | null }[] };
  const courtNameById = new Map((courts ?? []).map((c) => [c.id, c.name_ar]));
  const caseDetailById = new Map((casesDetail.data ?? []).map((c) => [c.id, c]));

  const caseList: RetrievedCase[] = [...caseHitMap.entries()].map(([id, { row, term }]) => {
    const d = caseDetailById.get(id);
    return {
      id,
      title: row.title ?? d?.case_number ?? "",
      courtName: d?.court_id ? courtNameById.get(d.court_id) ?? null : null,
      year: d?.year ?? null,
      judgmentDate: d?.judgment_date ?? null,
      citation: d?.citation_ar ?? row.subtitle ?? null,
      caseNumber: d?.case_number ?? row.identifier ?? null,
      principle: d?.principle_ar ?? null,
      excerptHtml: row.headline ?? row.snippet ?? "",
      authority: d ? caseAuthority(d) : "unverified",
      slug: row.slug,
      sourceUrl: d?.source_url ?? null,
      matchedTerm: term,
      rank: row.rank,
    };
  });

  const principleDetailById = new Map((principlesDetail.data ?? []).map((p) => [p.id, p]));
  const principleList: RetrievedPrinciple[] = [...principleHitMap.entries()].map(([id, { row, term }]) => {
    const d = principleDetailById.get(id);
    return {
      id,
      title: row.title ?? "",
      category: d?.category ?? row.subtitle ?? null,
      summary: d?.summary_ar ?? row.snippet ?? null,
      slug: row.slug,
      matchedTerm: term,
      rank: row.rank,
    };
  });

  const lawList = [...lawMap.values()].sort((a, b) => b.rank - a.rank);
  caseList.sort((a, b) => b.rank - a.rank);
  principleList.sort((a, b) => b.rank - a.rank);

  // Per-term "issue lens" — the honest relationship chain (§F) for the map view.
  const issues: IssueLens[] = terms.map(({ term, origin }) => {
    const topLaw = lawList.find((l) => l.matchedTerm === term) ?? null;
    const topCase = caseList.find((c) => c.matchedTerm === term) ?? null;
    const topPrinciple = principleList.find((p) => p.matchedTerm === term) ?? null;
    return { term, origin, topLaw, topCase, topPrinciple };
  });

  return {
    factsExcerpt: excerpt,
    factsIsTruncated: truncated,
    issues,
    laws: lawList.slice(0, DISPLAY_CAP),
    cases: caseList.slice(0, DISPLAY_CAP),
    principles: principleList.slice(0, DISPLAY_CAP),
    hasAnyResults: lawList.length > 0 || caseList.length > 0 || principleList.length > 0,
  };
}

CMFIX3_EOF
rm -- "$0" 2>/dev/null || true
git add -A
git commit -m "Exclude common given names from Case Mapper extracted legal-issue terms"
git push
echo ">> Done. Vercel will auto-deploy from this push."
