#!/usr/bin/env bash
set -e
echo '>> Creating Case Mapper Phase 1 files...'
mkdir -p "app/case-mapper" "components" "components/case-mapper" "lib" "lib/case-mapper"
cat > "lib/i18n.ts" <<'CMFILE_EOF'
export type Locale = "ar" | "en";

export const LOCALE_COOKIE = "makuria_locale";
export const DEFAULT_LOCALE: Locale = "ar";

export const dictionaries: Record<Locale, Record<string, string>> = {
  ar: {
    siteName: "مكوريا",
    siteTagline: "معهد مكوريا القانوني — منصة الذكاء القانوني السودانية",
    navHome: "الرئيسية",
    navLaws: "القوانين",
    navCases: "السوابق القضائية",
    navPrinciples: "المبادئ القانونية",
    navSearch: "البحث الذكي",
    navWorkspace: "مساحة المحامي",
    navLogin: "تسجيل الدخول",
    navLogout: "تسجيل الخروج",
    heroTitle: "أول منصة سودانية للذكاء القانوني",
    heroSubtitle:
      "قوانين، سوابق قضائية، ومبادئ قانونية موثّقة — بحث ذكي وتحقق من المصادر.",
    exploreLaws: "استعرض القوانين",
    exploreCases: "استعرض السوابق القضائية",
    searchPlaceholder: "ابحث في القوانين والسوابق والمواد بالكلمة المفتاحية",
    searchButton: "بحث",
    noResults: "لا توجد نتائج مطابقة",
    loadMore: "المزيد",
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
    of: "من",
    verified: "موثّق",
    unverified: "غير موثّق — يتطلب مراجعة قانونية",
    comingSoonTitle: "قيد التطوير",
    comingSoonBody:
      "هذه الوحدة جزء من مساحة عمل المحامي في مكوريا وسيتم بناؤها في مرحلة لاحقة. لا توجد بيانات أو وظائف مُصطنعة هنا.",
    workspaceWelcome: "مرحبًا بك في مساحة عمل المحامي",
    workspaceEmpty: "لم يتم إنشاء أي ملفات قضايا بعد.",
    loginTitle: "تسجيل الدخول",
    signupTitle: "إنشاء حساب محامٍ",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "إرسال",
    noAccount: "ليس لديك حساب؟",
    haveAccount: "لديك حساب بالفعل؟",
    createAccount: "إنشاء حساب",
    signIn: "تسجيل الدخول",
    articlesCount: "مادة",
    lawNumber: "رقم القانون",
    yearIssued: "سنة الإصدار",
    court: "المحكمة",
    caseNumber: "رقم القضية",
    judgmentDate: "تاريخ الحكم",
    footerRights: "جميع الحقوق محفوظة",
    footerNotice:
      "المحتوى القانوني في هذه النسخة التجريبية مصدره نفس قاعدة بيانات مكوريا الإنتاجية — لا يوجد محتوى مُصطنع.",

    // Case Mapper (Phase 1)
    cmPageTitle: "خريطة القضية — Case Mapper",
    cmFactsLabel: "أدخل وقائع القضية",
    cmFactsPlaceholder: "اكتب وقائع القضية بالتفصيل بالعربية...",
    cmCaseType: "نوع القضية",
    cmCourt: "المحكمة",
    cmJurisdiction: "الولاية / الاختصاص",
    cmIncidentDate: "تاريخ الواقعة",
    cmKeywords: "كلمات مفتاحية",
    cmAnalyzeButton: "حلّل القضية",
    cmAnalyzing: "جارٍ التحليل...",
    cmEmptyFacts: "الرجاء إدخال وقائع القضية قبل التحليل.",
    cmErrorState: "حدث خطأ أثناء تحليل القضية. يرجى المحاولة مرة أخرى.",
    cmNoResultsAtAll:
      "لم يتم العثور على أي مرجع مطابق في قاعدة مكوريا لهذه الوقائع. جرّب إضافة كلمات مفتاحية أكثر تحديدًا.",
    cmSectionSummary: "ملخص الوقائع",
    cmSummaryNote: "عرض أولي للوقائع كما أدخلتها — بدون تفسير أو استنتاج.",
    cmSummaryTruncated: "(تم عرض الجزء الأول من النص المدخل)",
    cmSectionIssues: "المسائل القانونية المحتملة",
    cmIssuesNote: "زوايا بحث أولية مستخرجة آليًا من النص المدخل — تحليل تمهيدي، وليست تكييفًا قانونيًا نهائيًا.",
    cmIssueOriginCaseType: "من نوع القضية",
    cmIssueOriginKeyword: "من الكلمات المفتاحية",
    cmIssueOriginExtracted: "مستخرجة من نص الوقائع",
    cmSectionLaws: "القوانين والمواد ذات الصلة",
    cmSectionCases: "السوابق القضائية ذات الصلة",
    cmSectionPrinciples: "المبادئ القانونية",
    cmSectionMap: "خريطة الربط",
    cmSectionSources: "المصادر",
    cmMatchedOn: "تمت المطابقة على",
    cmArticleLabel: "المادة",
    cmNoLaws: "لا توجد قوانين أو مواد مطابقة لهذه المسألة.",
    cmNoCases: "لا توجد سوابق قضائية مطابقة لهذه المسألة.",
    cmNoPrinciples: "لا توجد مبادئ قانونية مطابقة لهذه المسألة.",
    cmMapFacts: "الوقائع",
    cmMapIssue: "المسألة القانونية",
    cmMapLaw: "النص القانوني",
    cmMapCase: "السابقة القضائية",
    cmMapPrinciple: "المبدأ القانوني",
    cmAuthorityVerified: "موثّق",
    cmAuthorityNeedsReview: "يحتاج مراجعة",
    cmAuthorityOverruled: "منقوض — لا يُستشهد به كسند قائم",
    cmAuthorityUnverified: "غير متحقق",
    cmSourceLink: "مصدر الوثيقة",
    cmSourceUnavailable: "المصدر غير متاح في قاعدة مكوريا",
    cmAnalysisLabel: "تحليل — وليس سندًا قانونيًا",
    cmAuthorityLabel: "سند قانوني موثّق من قاعدة مكوريا",
    cmRelevanceReason: "سبب الصلة",
    cmDisclaimer:
      "خريطة القضية أداة بحث أولية تعرض فقط ما هو موجود فعليًا في قاعدة بيانات مكوريا. أي استنتاج أو تصنيف هنا هو تحليل آلي أولي يتطلب مراجعة محامٍ مرخّص، وليس رأيًا قانونيًا.",
  },
  en: {
    siteName: "Makuria",
    siteTagline: "Makuria Legal Institute — Sudanese Legal Intelligence Platform",
    navHome: "Home",
    navLaws: "Laws",
    navCases: "Judicial Precedents",
    navPrinciples: "Legal Principles",
    navSearch: "Smart Search",
    navWorkspace: "Lawyer Workspace",
    navLogin: "Log in",
    navLogout: "Log out",
    heroTitle: "Sudan's First AI-Powered Legal Intelligence Platform",
    heroSubtitle:
      "Verified laws, judicial precedents, and legal principles — smart search with source verification.",
    exploreLaws: "Browse Laws",
    exploreCases: "Browse Precedents",
    searchPlaceholder: "Search laws, cases, and articles by keyword",
    searchButton: "Search",
    noResults: "No matching results",
    loadMore: "Load more",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    verified: "Verified",
    unverified: "Unverified — requires legal review",
    comingSoonTitle: "Coming Soon",
    comingSoonBody:
      "This module is part of the Makuria Lawyer Workspace and will be built in a later phase. No fabricated data or functionality lives here.",
    workspaceWelcome: "Welcome to your Lawyer Workspace",
    workspaceEmpty: "No matters have been created yet.",
    loginTitle: "Log in",
    signupTitle: "Create a lawyer account",
    email: "Email",
    password: "Password",
    submit: "Submit",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    createAccount: "Create account",
    signIn: "Log in",
    articlesCount: "articles",
    lawNumber: "Law No.",
    yearIssued: "Year issued",
    court: "Court",
    caseNumber: "Case No.",
    judgmentDate: "Judgment date",
    footerRights: "All rights reserved",
    footerNotice:
      "Legal content on this staging build is sourced from the same production Makuria database — nothing here is fabricated.",

    // Case Mapper (Phase 1)
    cmPageTitle: "Case Mapper — خريطة القضية",
    cmFactsLabel: "Enter the case facts",
    cmFactsPlaceholder: "Describe the case facts in detail...",
    cmCaseType: "Case type",
    cmCourt: "Court",
    cmJurisdiction: "Jurisdiction",
    cmIncidentDate: "Incident date",
    cmKeywords: "Keywords",
    cmAnalyzeButton: "Analyze case",
    cmAnalyzing: "Analyzing...",
    cmEmptyFacts: "Please enter the case facts before analyzing.",
    cmErrorState: "Something went wrong analyzing the case. Please try again.",
    cmNoResultsAtAll:
      "No matching authority was found in the Makuria database for these facts. Try adding more specific keywords.",
    cmSectionSummary: "Facts Summary",
    cmSummaryNote: "A plain preview of the facts as entered — no interpretation or inference.",
    cmSummaryTruncated: "(showing the leading portion of the text you entered)",
    cmSectionIssues: "Potential Legal Issues",
    cmIssuesNote: "Preliminary search angles extracted mechanically from the text — an initial pass, not a final legal classification.",
    cmIssueOriginCaseType: "from case type",
    cmIssueOriginKeyword: "from keywords",
    cmIssueOriginExtracted: "extracted from the facts",
    cmSectionLaws: "Related Laws & Articles",
    cmSectionCases: "Related Precedents",
    cmSectionPrinciples: "Legal Principles",
    cmSectionMap: "Relationship Map",
    cmSectionSources: "Sources",
    cmMatchedOn: "Matched on",
    cmArticleLabel: "Article",
    cmNoLaws: "No matching law or article found for this issue.",
    cmNoCases: "No matching precedent found for this issue.",
    cmNoPrinciples: "No matching legal principle found for this issue.",
    cmMapFacts: "Facts",
    cmMapIssue: "Legal Issue",
    cmMapLaw: "Legal Text",
    cmMapCase: "Precedent",
    cmMapPrinciple: "Legal Principle",
    cmAuthorityVerified: "Verified",
    cmAuthorityNeedsReview: "Needs review",
    cmAuthorityOverruled: "Overruled — not citable as standing authority",
    cmAuthorityUnverified: "Unverified",
    cmSourceLink: "Source document",
    cmSourceUnavailable: "Source not available in the Makuria database",
    cmAnalysisLabel: "Analysis — not legal authority",
    cmAuthorityLabel: "Verified legal authority from the Makuria database",
    cmRelevanceReason: "Relevance",
    cmDisclaimer:
      "Case Mapper is a preliminary research tool that only surfaces what actually exists in the Makuria database. Any grouping or inference here is preliminary automated analysis requiring review by a licensed lawyer, not a legal opinion.",
  },
};

export function t(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
CMFILE_EOF
echo "  wrote lib/i18n.ts"
cat > "lib/case-mapper/analyze.ts" <<'CMFILE_EOF'
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
CMFILE_EOF
echo "  wrote lib/case-mapper/analyze.ts"
cat > "components/WorkspaceNav.tsx" <<'CMFILE_EOF'
import Link from "next/link";
import { Locale } from "@/lib/i18n";

const ITEMS: { href: string; label_ar: string; label_en: string; status: "shell" | "planned" }[] = [
  { href: "/workspace", label_ar: "نظرة عامة", label_en: "Overview", status: "shell" },
  { href: "/matters", label_ar: "الملفات القضائية", label_en: "Matters", status: "planned" },
  { href: "/case-mapper", label_ar: "خريطة القضية", label_en: "Case Mapper", status: "shell" },
  { href: "/quick-check", label_ar: "الفحص السريع", label_en: "Quick Check", status: "planned" },
  { href: "/practical-law", label_ar: "القانون العملي بالسودان", label_en: "Practical Law Sudan", status: "planned" },
  { href: "/alerts", label_ar: "التنبيهات", label_en: "Alerts", status: "planned" },
];

export function WorkspaceNav({ locale }: { locale: Locale }) {
  return (
    <nav className="w-full shrink-0 border-b pb-4 md:w-56 md:border-b-0 md:border-e md:pe-4 md:pb-0" style={{ borderColor: "var(--mk-border)" }}>
      <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-neutral-100"
            >
              <span>{locale === "ar" ? item.label_ar : item.label_en}</span>
              {item.status === "planned" && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                  {locale === "ar" ? "قريبًا" : "soon"}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
CMFILE_EOF
echo "  wrote components/WorkspaceNav.tsx"
cat > "components/case-mapper/Highlight.tsx" <<'CMFILE_EOF'
/**
 * Renders a ts_headline() result (StartSel=<mark>, StopSel=</mark>) as
 * React nodes without dangerouslySetInnerHTML — split on the tags rather
 * than injecting raw HTML, so this never becomes an XSS vector even
 * though the source is trusted, server-generated corpus text.
 */
export function Highlight({ html }: { html: string }) {
  if (!html) return null;
  const parts = html.split(/(<mark>|<\/mark>)/g);
  const nodes: React.ReactNode[] = [];
  let marking = false;
  parts.forEach((part, i) => {
    if (part === "<mark>") {
      marking = true;
      return;
    }
    if (part === "</mark>") {
      marking = false;
      return;
    }
    if (!part) return;
    nodes.push(
      marking ? (
        <mark key={i} className="rounded-sm px-0.5" style={{ background: "var(--mk-gold-soft)" }}>
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  });
  return <>{nodes}</>;
}
CMFILE_EOF
echo "  wrote components/case-mapper/Highlight.tsx"
cat > "components/case-mapper/AuthorityBadge.tsx" <<'CMFILE_EOF'
import { Locale, t } from "@/lib/i18n";
import type { AuthorityLevel } from "@/lib/case-mapper/analyze";

/**
 * Case authority strength badge. Reads `cases.authority_status`
 * (good_law / limited / overruled / under_review / null) — a real,
 * existing field, not a new status invented for Case Mapper. `overruled`
 * gets its own visually distinct (red) treatment: a case must never look
 * like standing authority once it's been overruled.
 */
export function AuthorityBadge({ level, locale }: { level: AuthorityLevel; locale: Locale }) {
  const styles: Record<AuthorityLevel, { bg: string; fg: string; key: string }> = {
    verified: { bg: "var(--mk-verified-bg)", fg: "var(--mk-verified-fg)", key: "cmAuthorityVerified" },
    needs_review: { bg: "var(--mk-unverified-bg)", fg: "var(--mk-unverified-fg)", key: "cmAuthorityNeedsReview" },
    overruled: { bg: "#fdeaea", fg: "#a3231c", key: "cmAuthorityOverruled" },
    unverified: { bg: "#f2f2f0", fg: "#5a5a55", key: "cmAuthorityUnverified" },
  };
  const s = styles[level];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {t(locale, s.key)}
    </span>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/AuthorityBadge.tsx"
cat > "components/case-mapper/CaseInputForm.tsx" <<'CMFILE_EOF'
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Locale, t } from "@/lib/i18n";

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1";

export function CaseInputForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: {
    facts: string;
    caseType: string;
    court: string;
    jurisdiction: string;
    incidentDate: string;
    keywords: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);
  const [values, setValues] = useState(initial);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.facts.trim()) {
      setClientError(t(locale, "cmEmptyFacts"));
      return;
    }
    setClientError(null);
    const params = new URLSearchParams();
    params.set("facts", values.facts.trim());
    if (values.caseType.trim()) params.set("case_type", values.caseType.trim());
    if (values.court.trim()) params.set("court", values.court.trim());
    if (values.jurisdiction.trim()) params.set("jurisdiction", values.jurisdiction.trim());
    if (values.incidentDate.trim()) params.set("incident_date", values.incidentDate.trim());
    if (values.keywords.trim()) params.set("keywords", values.keywords.trim());
    params.set("submitted", "1");
    startTransition(() => {
      router.push(`/case-mapper?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isPending}>
      <div>
        <label htmlFor="cm-facts" className="mb-1.5 block text-sm font-medium">
          {t(locale, "cmFactsLabel")}
        </label>
        <textarea
          id="cm-facts"
          name="facts"
          rows={8}
          value={values.facts}
          onChange={(e) => setValues((v) => ({ ...v, facts: e.target.value }))}
          placeholder={t(locale, "cmFactsPlaceholder")}
          className={inputClass}
          style={{ borderColor: "var(--mk-border)" }}
        />
        {clientError && <p className="mt-1.5 text-sm text-red-600">{clientError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <label htmlFor="cm-case-type" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmCaseType")}
          </label>
          <input
            id="cm-case-type"
            type="text"
            value={values.caseType}
            onChange={(e) => setValues((v) => ({ ...v, caseType: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label htmlFor="cm-court" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmCourt")}
          </label>
          <input
            id="cm-court"
            type="text"
            value={values.court}
            onChange={(e) => setValues((v) => ({ ...v, court: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label htmlFor="cm-jurisdiction" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmJurisdiction")}
          </label>
          <input
            id="cm-jurisdiction"
            type="text"
            value={values.jurisdiction}
            onChange={(e) => setValues((v) => ({ ...v, jurisdiction: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label htmlFor="cm-incident-date" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmIncidentDate")}
          </label>
          <input
            id="cm-incident-date"
            type="date"
            value={values.incidentDate}
            onChange={(e) => setValues((v) => ({ ...v, incidentDate: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cm-keywords" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmKeywords")}
          </label>
          <input
            id="cm-keywords"
            type="text"
            value={values.keywords}
            onChange={(e) => setValues((v) => ({ ...v, keywords: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
        style={{ background: "var(--mk-gold)" }}
      >
        {isPending ? t(locale, "cmAnalyzing") : t(locale, "cmAnalyzeButton")}
      </button>
    </form>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/CaseInputForm.tsx"
cat > "components/case-mapper/CaseSummary.tsx" <<'CMFILE_EOF'
import { Locale, t } from "@/lib/i18n";

export function CaseSummary({
  locale,
  excerpt,
  truncated,
}: {
  locale: Locale;
  excerpt: string;
  truncated: boolean;
}) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{t(locale, "cmSectionSummary")}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t(locale, "cmSummaryNote")}</p>
      <div className="rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ borderColor: "var(--mk-border)" }}>
        {excerpt}
        {truncated && <p className="mt-2 text-xs text-neutral-400">{t(locale, "cmSummaryTruncated")}</p>}
      </div>
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/CaseSummary.tsx"
cat > "components/case-mapper/LegalIssues.tsx" <<'CMFILE_EOF'
import { Locale, t } from "@/lib/i18n";
import type { IssueLens } from "@/lib/case-mapper/analyze";

const ORIGIN_KEY: Record<IssueLens["origin"], string> = {
  case_type: "cmIssueOriginCaseType",
  keyword: "cmIssueOriginKeyword",
  extracted: "cmIssueOriginExtracted",
};

export function LegalIssues({ locale, issues }: { locale: Locale; issues: IssueLens[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{t(locale, "cmSectionIssues")}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t(locale, "cmIssuesNote")}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {issues.map((issue) => (
          <li
            key={issue.term}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--mk-border)" }}
          >
            <p className="font-medium">{issue.term}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--mk-gold)" }}>
              {t(locale, "cmAnalysisLabel")} · {t(locale, ORIGIN_KEY[issue.origin])}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/LegalIssues.tsx"
cat > "components/case-mapper/RelatedLaws.tsx" <<'CMFILE_EOF'
import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Highlight } from "@/components/case-mapper/Highlight";
import type { RetrievedAuthority } from "@/lib/case-mapper/analyze";

export function RelatedLaws({ locale, laws }: { locale: Locale; laws: RetrievedAuthority[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionLaws")}</h2>
      {laws.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoLaws")}</p>
      ) : (
        <ul className="space-y-3">
          {laws.map((law) => (
            <li key={law.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  {law.type === "article" ? (
                    <p className="font-medium">
                      {law.lawTitle}
                      {law.articleNumber && (
                        <span className="text-neutral-500">
                          {" "}
                          — {t(locale, "cmArticleLabel")} {law.articleNumber}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="font-medium">{law.title}</p>
                  )}
                </div>
                <VerificationBadge verified={law.verified} locale={locale} />
              </div>
              <p className="mb-2 text-sm leading-relaxed text-neutral-700">
                <Highlight html={law.excerptHtml} />
              </p>
              <p className="text-xs text-neutral-400">
                {t(locale, "cmMatchedOn")}: {law.matchedTerm}
              </p>
              {law.slug && law.type === "law" && (
                <Link href={`/laws/${law.slug}`} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                  {locale === "ar" ? "عرض القانون كاملاً ←" : "View full law →"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/RelatedLaws.tsx"
cat > "components/case-mapper/RelatedCases.tsx" <<'CMFILE_EOF'
import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { AuthorityBadge } from "@/components/case-mapper/AuthorityBadge";
import { Highlight } from "@/components/case-mapper/Highlight";
import type { RetrievedCase } from "@/lib/case-mapper/analyze";

export function RelatedCases({ locale, cases }: { locale: Locale; cases: RetrievedCase[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionCases")}</h2>
      {cases.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoCases")}</p>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="font-medium">{c.title}</p>
                <AuthorityBadge level={c.authority} locale={locale} />
              </div>
              <p className="mb-2 text-xs text-neutral-500">
                {[c.courtName, c.year ?? undefined, c.citation ?? c.caseNumber ?? undefined]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {c.principle && (
                <p className="mb-2 text-sm leading-relaxed">
                  <span className="font-medium">{locale === "ar" ? "المبدأ: " : "Principle: "}</span>
                  {c.principle}
                </p>
              )}
              <p className="mb-2 text-sm leading-relaxed text-neutral-700">
                <span className="text-xs font-medium text-neutral-500">{t(locale, "cmRelevanceReason")}: </span>
                <Highlight html={c.excerptHtml} />
              </p>
              <p className="text-xs text-neutral-400">
                {t(locale, "cmMatchedOn")}: {c.matchedTerm}
              </p>
              {c.slug && (
                <Link href={`/cases/${c.slug}`} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                  {locale === "ar" ? "عرض السابقة كاملة ←" : "View full precedent →"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/RelatedCases.tsx"
cat > "components/case-mapper/LegalPrinciples.tsx" <<'CMFILE_EOF'
import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import type { RetrievedPrinciple } from "@/lib/case-mapper/analyze";

export function LegalPrinciples({ locale, principles }: { locale: Locale; principles: RetrievedPrinciple[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionPrinciples")}</h2>
      {principles.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoPrinciples")}</p>
      ) : (
        <ul className="space-y-3">
          {principles.map((p) => (
            <li key={p.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <p className="font-medium">{p.title}</p>
              {p.category && <p className="mt-0.5 text-xs text-neutral-500">{p.category}</p>}
              {p.summary && <p className="mt-2 text-sm leading-relaxed">{p.summary.slice(0, 220)}</p>}
              <p className="mt-2 text-xs text-neutral-400">
                {t(locale, "cmMatchedOn")}: {p.matchedTerm}
              </p>
              {p.slug && (
                <Link href={`/principles/${p.slug}`} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                  {locale === "ar" ? "عرض المبدأ كاملاً ←" : "View full principle →"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/LegalPrinciples.tsx"
cat > "components/case-mapper/CaseMap.tsx" <<'CMFILE_EOF'
import { Locale, t } from "@/lib/i18n";
import { AuthorityBadge } from "@/components/case-mapper/AuthorityBadge";
import { VerificationBadge } from "@/components/VerificationBadge";
import type { IssueLens } from "@/lib/case-mapper/analyze";

/**
 * §F "خريطة الربط" — a plain card/tree layout, deliberately not a graph
 * library (none is installed, and Phase 1 doesn't need one). Each column
 * is a single honest chain: الوقائع → المسألة → النص القانوني →
 * السابقة → المبدأ, per issue lens. Any empty slot says so plainly
 * rather than being skipped silently.
 */
function MapNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--mk-border)" }}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--mk-gold)" }}>
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1 text-neutral-300" aria-hidden>
      ↓
    </div>
  );
}

export function CaseMap({ locale, issues }: { locale: Locale; issues: IssueLens[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionMap")}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {issues.map((issue) => (
          <div key={issue.term} className="flex flex-col">
            <MapNode label={t(locale, "cmMapFacts")}>
              <p className="text-neutral-600">
                {issue.origin === "case_type"
                  ? t(locale, "cmIssueOriginCaseType")
                  : issue.origin === "keyword"
                    ? t(locale, "cmIssueOriginKeyword")
                    : t(locale, "cmIssueOriginExtracted")}
              </p>
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapIssue")}>
              <p className="font-medium">{issue.term}</p>
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapLaw")}>
              {issue.topLaw ? (
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {issue.topLaw.type === "article"
                      ? `${issue.topLaw.lawTitle ?? ""} — ${t(locale, "cmArticleLabel")} ${issue.topLaw.articleNumber ?? ""}`
                      : issue.topLaw.title}
                  </span>
                  <VerificationBadge verified={issue.topLaw.verified} locale={locale} />
                </div>
              ) : (
                <span className="text-neutral-400">{t(locale, "cmNoLaws")}</span>
              )}
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapCase")}>
              {issue.topCase ? (
                <div className="flex items-center justify-between gap-2">
                  <span>{issue.topCase.title}</span>
                  <AuthorityBadge level={issue.topCase.authority} locale={locale} />
                </div>
              ) : (
                <span className="text-neutral-400">{t(locale, "cmNoCases")}</span>
              )}
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapPrinciple")}>
              {issue.topPrinciple ? (
                <span>{issue.topPrinciple.title}</span>
              ) : (
                <span className="text-neutral-400">{t(locale, "cmNoPrinciples")}</span>
              )}
            </MapNode>
          </div>
        ))}
      </div>
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/CaseMap.tsx"
cat > "components/case-mapper/SourcesPanel.tsx" <<'CMFILE_EOF'
import { Locale, t } from "@/lib/i18n";
import type { RetrievedAuthority, RetrievedCase } from "@/lib/case-mapper/analyze";

export function SourcesPanel({
  locale,
  laws,
  cases,
}: {
  locale: Locale;
  laws: RetrievedAuthority[];
  cases: RetrievedCase[];
}) {
  const lawSources = laws.filter((l) => l.sourceUrl);
  const caseSources = cases.filter((c) => c.sourceUrl);
  const anySources = lawSources.length > 0 || caseSources.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionSources")}</h2>
      {!anySources ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmSourceUnavailable")}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {lawSources.map((l) => (
            <li key={`law-${l.id}`}>
              <a href={l.sourceUrl!} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--mk-gold)]">
                {l.type === "article" ? l.lawTitle : l.title} — {t(locale, "cmSourceLink")}
              </a>
            </li>
          ))}
          {caseSources.map((c) => (
            <li key={`case-${c.id}`}>
              <a href={c.sourceUrl!} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--mk-gold)]">
                {c.title} — {t(locale, "cmSourceLink")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
CMFILE_EOF
echo "  wrote components/case-mapper/SourcesPanel.tsx"
cat > "app/case-mapper/page.tsx" <<'CMFILE_EOF'
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { CaseInputForm } from "@/components/case-mapper/CaseInputForm";
import { CaseSummary } from "@/components/case-mapper/CaseSummary";
import { LegalIssues } from "@/components/case-mapper/LegalIssues";
import { RelatedLaws } from "@/components/case-mapper/RelatedLaws";
import { RelatedCases } from "@/components/case-mapper/RelatedCases";
import { LegalPrinciples } from "@/components/case-mapper/LegalPrinciples";
import { CaseMap } from "@/components/case-mapper/CaseMap";
import { SourcesPanel } from "@/components/case-mapper/SourcesPanel";
import { analyzeCase } from "@/lib/case-mapper/analyze";

function paramStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function CaseMapperPage(props: PageProps<"/case-mapper">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  const facts = paramStr(searchParams.facts);
  const caseType = paramStr(searchParams.case_type);
  const court = paramStr(searchParams.court);
  const jurisdiction = paramStr(searchParams.jurisdiction);
  const incidentDate = paramStr(searchParams.incident_date);
  const keywords = paramStr(searchParams.keywords);
  const submitted = paramStr(searchParams.submitted) === "1";

  let result: Awaited<ReturnType<typeof analyzeCase>> | null = null;
  let errored = false;

  if (submitted && facts.trim()) {
    try {
      const supabase = await createClient();
      result = await analyzeCase(supabase, {
        facts,
        caseType: caseType || undefined,
        court: court || undefined,
        jurisdiction: jurisdiction || undefined,
        incidentDate: incidentDate || undefined,
        keywords: keywords || undefined,
      });
    } catch {
      errored = true;
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row">
      <WorkspaceNav locale={locale} />
      <div className="min-w-0 flex-1 space-y-10">
        <div>
          <h1 className="mb-1 text-2xl font-bold">{t(locale, "cmPageTitle")}</h1>
          <p className="mb-6 text-xs text-neutral-500">{t(locale, "cmDisclaimer")}</p>

          <CaseInputForm
            locale={locale}
            initial={{ facts, caseType, court, jurisdiction, incidentDate, keywords }}
          />
        </div>

        {submitted && !facts.trim() && (
          <p className="text-sm text-red-600">{t(locale, "cmEmptyFacts")}</p>
        )}

        {errored && <p className="text-sm text-red-600">{t(locale, "cmErrorState")}</p>}

        {result && (
          <>
            {!result.hasAnyResults ? (
              <p className="rounded-lg border p-4 text-sm text-neutral-600" style={{ borderColor: "var(--mk-border)" }}>
                {t(locale, "cmNoResultsAtAll")}
              </p>
            ) : null}

            <CaseSummary locale={locale} excerpt={result.factsExcerpt} truncated={result.factsIsTruncated} />
            <LegalIssues locale={locale} issues={result.issues} />
            <RelatedLaws locale={locale} laws={result.laws} />
            <RelatedCases locale={locale} cases={result.cases} />
            <LegalPrinciples locale={locale} principles={result.principles} />
            <CaseMap locale={locale} issues={result.issues} />
            <SourcesPanel locale={locale} laws={result.laws} cases={result.cases} />
          </>
        )}
      </div>
    </div>
  );
}
CMFILE_EOF
echo "  wrote app/case-mapper/page.tsx"
cat > "app/case-mapper/loading.tsx" <<'CMFILE_EOF'
export default function CaseMapperLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row">
      <div className="h-40 w-full shrink-0 animate-pulse rounded-md bg-neutral-100 md:w-56" />
      <div className="flex-1 space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-neutral-100" />
        <div className="h-40 w-full animate-pulse rounded-md bg-neutral-100" />
        <div className="h-24 w-full animate-pulse rounded-md bg-neutral-100" />
      </div>
    </div>
  );
}
CMFILE_EOF
echo "  wrote app/case-mapper/loading.tsx"

echo '>> Removing this bundle script (not part of the app)...'
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
rm -f -- "$SCRIPT_PATH"

echo '>> Staging, committing, and pushing...'
git add -A
git commit -m "Add Case Mapper Phase 1: deterministic search over existing Makuria corpus (read-only, additive)"
git push
echo '>> Done. Now run: npm install && npm run build'
