import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyWithLLM } from "./llm-classifier";
import { classifyPrecedent, type PrecedentRelevance } from "./precedent-relevance";
import conceptMapJson from "./precedent-concept-map.json";
import {
  stripTashkeel,
  normalizeForKwMatch,
  tokenMatchesKw,
  factsMatchKeywords,
  factsMatchClaimMarker,
  factsMatchMoneyTake,
  factsMatchLethalWeapon,
  factsMatchLethalMethod,
  factsMatchIntentToKill,
  factsMatchWound,
  factsMatchDeliberateAssault,
  factsNegateIntentToKill,
  whichLethalMethod,
  factsMatchHotLiquidPour,
  factsMatchSeriousInjury,
  factsMatchDangerousSite,
  factsMatchDeath,
  factsMatchFireDamage,
  factsMatchMoneyDemand,
  factsMatchQadhfImputation,
  factsMatchBluntInstrument,
  factsStateIntentWords,
  factsMatchPropertyDamage,
  factsMatchAccidentMarker,
  factsMatchRescueNecessity,
  factsMatchParticipation,
  factsMatchGrossNegligence,
  factsMatchVehicle,
  factsMatchHaddTheftConditions,
  factsMatchDelivery,
  factsMatchWeaponPublicPlace,
  factsMatchNarcoticsContext,
  factsMatchLabPending,
  factsMatchKnowledgeDisputed,
  factsMatchConsentDisputed,
  factsMatchEntrustment,
  factsMatchContractualDefence,
  factsMatchTrustDisposal,
  factsMatchTrustDenial,
  factsMatchTrustNonReturn,
  factsMatchChequeDishonour,
  factsMatchChequeBalanceClaim,
  factsMatchChequeStopCause,
  factsMatchDocumentAlteration,
  factsMatchPublicOfficialFalseEntry,
  factsMatchAdminAppointmentReview,
  dropAthaIfWound,
  dropBareJurhIfWound,
  SUPPLY_TO_PERSON_KW,
  PUBLIC_OFFICIAL_KW,
  LEGAL_PROCEEDING_KW,
  UNIFORM_KW,
  IMPOSTOR_VERB_KW,
  TAKING_VERB_KW,
  MONEY_NOUN_KW,
} from "./kw-matcher.mjs";

/**
 * Case Mapper — deterministic retrieval over the Makuria corpus. No
 * embeddings, no external AI call, nothing invented: every term searched is
 * either something the lawyer typed or a phrase pulled out of their own facts
 * text, and every result is a real row returned by a deployed search function.
 *
 * Rewritten 2026-09-28 after an outside test found that four of six sample
 * cases failed, and that the site's ordinary /search returned better results
 * than this tool did. Three causes were found and fixed here:
 *
 * 1. WRONG ENGINE. This module called `universal_search` — the first of four
 *    deployed versions — while /search calls `quick_search_v4`. Measured on
 *    the live corpus with the row cap raised on both sides so the gap could
 *    not be an artefact of limits: «عمد» 8 → 82, «غسل» 5 → 49, «قتل» 23 → 57,
 *    «حضانة» 6 → 19. v4 also folds hamza/ta-marbuta/diacritics and
 *    Arabic-Indic digits, which is why it finds what v1 misses.
 *
 *    v4 returns `article` and `case` rows but not `law` or `principle`, so
 *    those two still come from `universal_search_v3`. Ranks are never compared
 *    across engines — each engine's results are ordered within themselves.
 *
 * 2. CASE TYPE SEARCHED AS A WORD. «جنائي» typed as the case type was sent to
 *    the search engine like any other term, so articles 21 and 22 of the
 *    Criminal Act surfaced in every criminal case regardless of its facts.
 *    In v4 that term matches 601 rows — nearly the whole corpus. The case type
 *    is now a *lens*: it maps to a category and promotes that category's
 *    results to the top. It never removes anything, because the category
 *    assignments are not complete enough to hide evidence behind.
 *
 * 3. A RESULT COULD ONLY BELONG TO ONE TERM. The merge kept a single
 *    `matchedTerm` per row and overwrote it whenever a higher-ranked hit
 *    arrived from a different term. The per-issue view then looked up
 *    `matchedTerm === term`, so an article found by two terms was credited to
 *    one and the other issue rendered *empty although it had matched*. Every
 *    row now carries `matchedTerms: string[]`.
 *
 * Two further weaknesses the outside test named are addressed:
 *   - Compound terms were split: «غسل أموال» became «غسل» + «أموال». Adjacent
 *     content words are now scored as phrases and searched whole, and the
 *     keywords field is split on commas only so a typed phrase survives.
 *   - Procedural vocabulary («المتهم», «قام», «دخل») was treated as legal
 *     subject matter. It is now excluded from *extracted* terms — never from
 *     what the lawyer typed deliberately.
 *
 * If a term matches nothing, that is reported rather than papered over.
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

/** Legal force of the law an article belongs to. A provision of a repealed
 * law must never be shown as if it were live authority — this rides along
 * with every article so the UI can say so. */
export type ForceStatus = "in_force" | "under_review" | "not_in_force" | "unknown";

export type RetrievedAuthority = {
  id: string;
  type: "law" | "article";
  title: string;
  lawTitle: string | null;
  articleNumber: string | null;
  excerptHtml: string;
  verified: boolean;
  slug: string | null;
  lawSlug: string | null;
  sourceUrl: string | null;
  force: ForceStatus;
  /** Raw `legal_status` from the articles table, used for the article badge.
   * Values: in_force | repealed | amended | disputed | not_yet_in_force | unknown | null */
  legalStatus: string | null;
  statusNote: string | null;
  matchedTerms: string[];
  rank: number;
  /** True when this law/article belongs to the primary category or a companion
   * law set for the resolved case type. Used for ranking and suppression. */
  inScope: boolean;
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
  matchedTerms: string[];
  inScope: boolean;
  rank: number;
  keywords: string[];
  tags: string[];
  relevance?: PrecedentRelevance;
};

export type RetrievedPrinciple = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  slug: string | null;
  matchedTerms: string[];
  rank: number;
};

export type IssueLens = {
  term: string;
  origin: "keyword" | "expanded" | "extracted";
  topLaw: RetrievedAuthority | null;
  topCase: RetrievedCase | null;
  topPrinciple: RetrievedPrinciple | null;
  /** True when the term was searched and simply matched nothing. The UI must
   * distinguish "no authority found" from "we never looked". */
  searchedAndEmpty: boolean;
};

export type DiscussItem = {
  concept: string;
  label: string;
  description?: string;
  /** "قرائن تُفحص:" items text (without the prefix label and without cautionLine).
   *  Rendered in its own paragraph with the "قرائن تُفحص:" label in bold. */
  evidenceLine?: string;
  /** Caution sentence that follows evidenceLine ("ولا يُجزم…" / "ولا يُستنتج…").
   *  Rendered on the line after evidenceLine. */
  cautionLine?: string;
  /** Narrator-level kill-intent negation note, present on قتل:وصف when
   *  factsNegateIntentToKill is true. Rendered as its own paragraph. */
  negationNote?: string;
  /** Conflict note shown only when the admin-appointment gate returns "conflict". */
  conflictLine?: string;
  articles: RetrievedAuthority[];
};

export type CaseMapResult = {
  factsExcerpt: string;
  factsIsTruncated: boolean;
  /** The case type as a lens, resolved to a corpus category — or null when it
   * matched no category, which is itself worth showing. `inferred` is true
   * when the user left caseType empty and criminal expansion rules fired. */
  caseTypeLens: { input: string; categoryNameAr: string | null; inferred: boolean } | null;
  /** Non-null only when the case type was inferred from the facts text. */
  inferredCaseType: string | null;
  issues: IssueLens[];
  laws: RetrievedAuthority[];
  cases: RetrievedCase[];
  principles: RetrievedPrinciple[];
  /** Number of out-of-scope articles/cases excluded from the main results
   * because ≥3 in-scope results were available. Zero means nothing was hidden. */
  outOfScopeCount: number;
  /** True when a case type was resolved AND every retrieved result falls outside
   * that category. Results noise exists but none is trustworthy for this case —
   * different from hasAnyResults=false (nothing found at all). The UI must show
   * a "no confident match" message rather than the unrelated results. */
  noConfidentMatch: boolean;
  hasAnyResults: boolean;
  /** Open points for the lawyer — fetched from DISCUSS_CONCEPT_TO_ARTICLES,
   *  never mixed into the ranked `laws` array. */
  discuss?: DiscussItem[];
  /** True when concept is مخدرات and intent (dealing vs. personal use) was not
   *  stated in the facts. Art. 15 and 20 are in discuss, not in laws. */
  intentUnknown?: boolean;
  /** Related legislation slugs — law slugs attached by deterministic rules, not
   *  retrieved by text search. e.g. traffic-law-2010 for vehicle cases. */
  relatedLaws?: string[];
  /** Breakdown of precedent relevance classification for cases returned. */
  precedentStats?: { direct: number; conditional: number; hidden: number; unindexed: number };
};

const MAX_TERMS = 6;
const CANDIDATE_LIMIT = 12;
const PER_TERM_LIMIT = 24;
const V3_PER_TYPE = 6;
const V3_OVERALL = 18;
const DISPLAY_CAP = 8;

// Common Arabic function words. Deliberately conservative: dropping a real
// legal noun would silently weaken retrieval, which is the worse failure.
const STOPWORDS = new Set([
  "في", "من", "إلى", "على", "عن", "أن", "إن", "أنه", "أنها", "التي", "الذي",
  "الذين", "و", "أو", "ثم", "قد", "كان", "كانت", "هذا", "هذه", "ذلك", "تلك",
  "لم", "لن", "لا", "ما", "مع", "بين", "عند", "بعد", "قبل", "كل", "بعض",
  "حيث", "حين", "إذا", "كما", "غير", "دون", "إلا", "هو", "هي", "هم", "أنا",
  "نحن", "انت", "انتم", "كانوا", "يكون", "تم", "كذلك", "وقد", "فقد",
]);

// Procedural and narrative vocabulary. These words are perfectly good Arabic
// and often legally meaningful in a sentence, but as *search terms* they match
// a large share of the corpus and drown the terms that actually identify the
// issue — «المتهم» pulls in every criminal provision ever written. Excluded
// from extracted terms only; a lawyer who types one deliberately still gets it.
const WEAK_TERMS = new Set([
  "المتهم", "متهم", "المتهمة", "المدعي", "المدعى", "المدعية", "عليه", "عليها",
  "الطرف", "الطرفان", "الأطراف", "الشخص", "شخص", "السيد", "المحكمة", "محكمة",
  "القاضي", "الدعوى", "دعوى", "القضية", "قضية", "الحكم", "حكم", "قام", "قامت",
  "دخل", "دخلت", "خرج", "ذهب", "قال", "قالت", "أفاد", "ذكر", "حضر", "طلب",
  "تقدم", "أصدر", "صدر", "يوم", "شهر", "سنة", "تاريخ", "رقم", "مبلغ", "جنيه",
  "الجنيه", "قرش", "أثناء", "خلال", "نحو", "حوالي", "تقريبا", "تقريباً",
  "الوقائع", "وقائع", "الموضوع", "بشأن", "بخصوص", "الحالة", "حالة",
  // Assertion / denial verbs: appear in virtually every court record but
  // identify no legal issue — "أقر بأنه..." is a frame, not a subject.
  "أقر", "أنكر", "ادعى", "نفى", "زعم", "أشار", "وصف", "أوضح", "صرّح", "صرح",
  // Completeness / quantity adverbs — no legal meaning as search terms.
  // "كاملاً" → stripTashkeel → "كاملا"; without this entry the ك-prefix
  // strip produces bare "اmlا" which drives spurious financial-law results.
  "كاملا", "كاملة",
]);

// Very common Sudanese/Arabic given names. A party's first name is a weak,
// near-random signal: a debt dispute pulls in an unrelated precedent only
// because both involve someone named «محمد».
const COMMON_GIVEN_NAMES = new Set([
  "محمد", "أحمد", "احمد", "علي", "عبدالله", "عبد", "إبراهيم",
  "ابراهيم", "الحسن", "حسن", "حسين", "عمر", "عثمان", "يوسف", "إسماعيل",
  "اسماعيل", "خالد", "عبدالرحمن", "عبدالرحيم", "الطيب", "الفاتح", "مصطفى",
  "مصطفي", "صالح", "آدم", "ادم", "بابكر", "التاج", "عوض", "النور", "نور",
  "عبدالعزيز", "الأمين", "الامين", "بشير", "عادل", "ياسر", "طارق", "كمال",
  "مأمون", "مامون", "فاطمة", "عائشة", "عايشة", "خديجة", "مريم", "زينب",
  "آمنة", "امنة", "حواء", "سارة", "هدى", "إيمان", "ايمان", "سلمى", "نعمات",
  "أسماء", "اسماء", "منى", "سعاد", "نجوى", "سمية", "سميه",
]);

/** Case type → corpus category slug. The input is free text, so this matches
 * on substrings of what the lawyer wrote rather than an exact value. */
const CASE_TYPE_TO_CATEGORY: { match: string[]; slug: string }[] = [
  { match: ["جناي", "جريمة", "جرائم", "عقوب"], slug: "criminal" },
  { match: ["أحوال شخصية", "احوال شخصية", "أسرة", "اسرة", "طلاق", "زواج", "نفقة", "حضانة", "ميراث", "تركة"], slug: "personal-status" },
  { match: ["تجاري", "شركات", "كمبيال", "إفلاس", "افلاس"], slug: "commercial" },
  { match: ["عمل", "عمالي", "عمالية", "نقاب"], slug: "labor" },
  { match: ["إداري", "اداري", "تنظيم"], slug: "administrative" },
  { match: ["دستور"], slug: "constitutional" },
  { match: ["مالي", "ضريب", "جمارك", "زكاة", "مصرف", "بنك"], slug: "financial" },
  { match: ["عسكري", "قوات مسلحة", "شرطة"], slug: "military" },
  { match: ["إجراء", "اجراء", "مرافع"], slug: "procedural" },
  { match: ["بيئ"], slug: "environmental" },
  { match: ["اقتصاد", "استثمار", "تعدين"], slug: "economic" },
  { match: ["اجتماعي", "معاشات", "تأمين اجتماعي"], slug: "social" },
  { match: ["دولي"], slug: "international" },
  { match: ["مدني", "عقد", "عقود", "أراضي", "اراضي", "ملكية", "إيجار", "ايجار"], slug: "civil" },
];

/**
 * Companion law slugs per case-type slug. A real case always spans multiple
 * domains: a theft charge needs the Criminal Act (substantive) but also
 * Criminal Procedure 1991 (how to prosecute) and Evidence 1993 (what proves
 * it). Companion laws are fetched by slug and their articles are marked
 * in-scope alongside the primary category's articles.
 */
const CASE_TYPE_COMPANIONS: Record<string, string[]> = {
  "criminal": ["criminal-procedure-1991", "evidence-law-1993", "public-prosecution-act-2017"],
  "civil": ["civil-procedure-1983", "evidence-law-1993", "arbitration-2016"],
  "personal-status": ["civil-procedure-1983", "evidence-law-1993"],
};

// ── Concept-to-article map ────────────────────────────────────────────────
// When a criminal expansion concept fires, fetch these specific articles
// directly by (lawSlug, articleNumber) — no text search for laws.
// Every entry is marked REVIEW until verified against the live corpus.
export type ConceptArticleEntry = {
  lawSlug: string;
  articleNumber: string;
  /** Optional override for the statusNote shown on the article inside a discuss card.
   * Use "معروضة للبحث، لا للتصنيف" for articles that are open points, not assertions. */
  statusNoteOverride?: string;
};

export const CONCEPT_TO_ARTICLES: Record<string, ConceptArticleEntry[]> = {
  "خيانة الأمانة": [
    { lawSlug: "criminal-law-1991", articleNumber: "177" }, // REVIEW
  ],
  // Commit 46: civil/abstain + entrustment facts → Art. 177 as research-only open point.
  "أمانة:مدني": [
    { lawSlug: "criminal-law-1991", articleNumber: "177", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 50: criminal + entrustment + mere non-return (no disposal, no supported denial) → research-only.
  "أمانة:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "177", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 41: hadd-primary concept — fires when all five preconditions stated.
  "سرقة:حدية": [
    { lawSlug: "criminal-law-1991", articleNumber: "170" }, // السرقة الحدية
    { lawSlug: "criminal-law-1991", articleNumber: "171" }, // عقوبة السرقة الحدية
    { lawSlug: "criminal-law-1991", articleNumber: "174" }, // جريمة السرقة (تعزيرية عند سقوط الحد)
  ],
  "سرقة": [
    { lawSlug: "criminal-law-1991", articleNumber: "174" }, // جريمة السرقة — always applicable
    // Arts. 170/171/172/173 (hadd theft) are conditional on hirz and nisab being
    // established; they are always routed to discuss via "سرقة:حد", never to laws.
  ],
  "نهب": [
    { lawSlug: "criminal-law-1991", articleNumber: "175" }, // النهب
  ],
  "تعدٍّ": [
    { lawSlug: "criminal-law-1991", articleNumber: "183" }, // REVIEW: التعدي الجنائي
  ],
  "اقتحام": [
    { lawSlug: "criminal-law-1991", articleNumber: "183" }, // REVIEW: التعدي الجنائي
  ],
  "احتيال": [
    { lawSlug: "criminal-law-1991", articleNumber: "178" }, // الاحتيال
    // Art. 111 (التصرف في الأموال لتفادي الحجز) removed: evasion of creditors, unrelated to fraud
  ],
  "تزوير": [
    { lawSlug: "criminal-law-1991", articleNumber: "122" }, // التزوير في المستندات
    { lawSlug: "criminal-law-1991", articleNumber: "123" }, // عقوبة التزوير في المستندات
    // Art. 124 moved to "تزوير:موظف" (Commit 49 — independent gate, never asserted directly)
  ],
  // Commit 49: authorization-dispute forgery — research-only, never a primary classification.
  "تزوير:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "122", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
    { lawSlug: "criminal-law-1991", articleNumber: "123", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Base "انتحال" is empty; sub-concepts are injected in analyzeCase based on keyword gates.
  "انتحال": [],
  "انتحال:موظف": [
    { lawSlug: "criminal-law-1991", articleNumber: "93" },  // انتحال صفة الموظف العام
  ],
  "انتحال:دعوى": [
    { lawSlug: "criminal-law-1991", articleNumber: "113" }, // انتحال شخصية الغير في دعوى
  ],
  "انتحال:زي": [
    { lawSlug: "criminal-law-1991", articleNumber: "60" },  // استعمال الزي والشارات
  ],
  "إيذاء جسيم": [
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // عقوبة الجراح العمد — penalty first
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // الجراح وأنواعها
    { lawSlug: "criminal-law-1991", articleNumber: "142" }, // الأذى
    { lawSlug: "criminal-law-1991", articleNumber: "143" }, // القوة الجنائية
  ],
  "أذى": [
    { lawSlug: "criminal-law-1991", articleNumber: "142" }, // الأذى
  ],
  "جرح": [
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // عقوبة الجراح العمد — word-list catch-all, rank-1
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // الجراح وأنواعها — definition
    // 140/141 belong to شبه عمد/خطأ only; 142 (الأذى) conflicts with wound; 143 (قوة جنائية) separate offence
  ],
  "جرح عمد": [
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // عقوبة الجراح العمد
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // الجراح وأنواعها — definition
  ],
  // Change 1 override: lethal method (non-weapon) + no stated wound → Art. 138 only.
  // Arts. 139 and 142 are shown in the إصابة:وصف discuss card instead.
  "جرح:وصف": [
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // الجراح وأنواعها — definition only
  ],
  "جرح شبه عمد": [
    { lawSlug: "criminal-law-1991", articleNumber: "140" }, // عقوبة الجراح شبه العمد
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // الجراح وأنواعها — definition
  ],
  "جرح خطأ": [
    { lawSlug: "criminal-law-1991", articleNumber: "141" }, // عقوبة الجراح الخطأ
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // الجراح وأنواعها — definition
  ],
  "قوة جنائية": [
    { lawSlug: "criminal-law-1991", articleNumber: "143" }, // القوة الجنائية
  ],
  "تشويه": [
    { lawSlug: "criminal-law-1991", articleNumber: "141أ" }, // تشويه أعضاء الأنثى
  ],
  "قتل": [
    { lawSlug: "criminal-law-1991", articleNumber: "130" }, // القتل العمد — penalty first
    { lawSlug: "criminal-law-1991", articleNumber: "129" }, // القتل وأنواعه
    { lawSlug: "criminal-law-1991", articleNumber: "131" }, // القتل شبه العمد
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // القتل الخطأ
  ],
  "قتل خطأ": [
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // القتل الخطأ
  ],
  "قتل عمد": [
    { lawSlug: "criminal-law-1991", articleNumber: "130" }, // القتل العمد — penalty
    { lawSlug: "criminal-law-1991", articleNumber: "129" }, // القتل وأنواعه — definition
  ],
  "قتل شبه عمد": [
    { lawSlug: "criminal-law-1991", articleNumber: "131" }, // القتل شبه العمد — penalty
    { lawSlug: "criminal-law-1991", articleNumber: "129" }, // القتل وأنواعه — definition
  ],
  // Homicide — intent/characterisation open: Art. 129 definition only, card covers 130+131
  "قتل:وصف": [
    { lawSlug: "criminal-law-1991", articleNumber: "129" }, // القتل وأنواعه — definition only
  ],
  // Explicit attempted homicide: stated intent + serious injury (Commit 33)
  "شروع:قتل": [
    { lawSlug: "criminal-law-1991", articleNumber: "20" },  // العقوبة على الشروع
    { lawSlug: "criminal-law-1991", articleNumber: "130" }, // القتل العمد
    { lawSlug: "criminal-law-1991", articleNumber: "19" },  // تعريف الشروع
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // عقوبة الجراح العمد
  ],
  "مخدرات": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "15" }, // الاتجار
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "12" }, // حظر التعامل
    // Art. 16 (تقديم) injected via discuss when supply keywords match; Art. 20 (تعاطي) excluded: intent already known
  ],
  // Stated personal use — intent known; Art. 20 applicable, Art. 16/15 excluded
  "مخدرات:قصد التعاطي": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "20" },
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "12" },
  ],
  "مركبة": [
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // القتل الخطأ
  ],
  "خطأ": [
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // القتل الخطأ
  ],
  "إتلاف جنائي": [
    { lawSlug: "criminal-law-1991", articleNumber: "182" }, // REVIEW: الإتلاف الجنائي
  ],
  "ابتزاز": [
    { lawSlug: "criminal-law-1991", articleNumber: "176" }, // REVIEW: الابتزاز
  ],
  "تملك جنائي": [
    { lawSlug: "criminal-law-1991", articleNumber: "180" }, // REVIEW: التملك الجنائي
  ],
  "استلام مسروق": [
    { lawSlug: "criminal-law-1991", articleNumber: "181" }, // REVIEW: استلام المال المسروق
  ],
  "حجز غير مشروع": [
    { lawSlug: "criminal-law-1991", articleNumber: "164" }, // الحجز غير المشروع
    { lawSlug: "criminal-law-1991", articleNumber: "165" }, // الاعتقال غير المشروع
  ],
  // ── State security ────────────────────────────────────────────────────────
  "تجسس": [
    { lawSlug: "criminal-law-1991", articleNumber: "53" },  // التجسس
    { lawSlug: "criminal-law-1991", articleNumber: "55" },  // إفشاء معلومات رسمية
    { lawSlug: "criminal-law-1991", articleNumber: "56" },  // إفشاء معلومات عسكرية
  ],
  "تقويض النظام الدستوري": [
    { lawSlug: "criminal-law-1991", articleNumber: "50" },  // تقويض النظام الدستوري
    { lawSlug: "criminal-law-1991", articleNumber: "51" },  // إثارة الحرب ضد الدولة
  ],
  "نشر أخبار كاذبة": [
    { lawSlug: "criminal-law-1991", articleNumber: "66" },  // نشر الأخبار الكاذبة
  ],
  "شغب": [
    { lawSlug: "criminal-law-1991", articleNumber: "67" },  // الشغب
    { lawSlug: "criminal-law-1991", articleNumber: "68" },  // عقوبة الشغب
    { lawSlug: "criminal-law-1991", articleNumber: "69" },  // الإخلال بالسلام العام
  ],
  // ── Alcohol / gambling ───────────────────────────────────────────────────
  "شرب خمر": [
    { lawSlug: "criminal-law-1991", articleNumber: "78" },  // شرب الخمر
    { lawSlug: "criminal-law-1991", articleNumber: "79" },  // التعامل في الخمر
  ],
  "ميسر": [
    { lawSlug: "criminal-law-1991", articleNumber: "80" },  // لعب الميسر
  ],
  // ── Corruption / official misconduct ────────────────────────────────────
  "رشوة": [
    { lawSlug: "criminal-law-1991", articleNumber: "88" },  // الرشوة
  ],
  "شهادة زور": [
    { lawSlug: "criminal-law-1991", articleNumber: "104" }, // شهادة الزور
    { lawSlug: "criminal-law-1991", articleNumber: "105" }, // استخدام بينة باطلة
  ],
  "اتهام كاذب": [
    { lawSlug: "criminal-law-1991", articleNumber: "114" }, // الاتهام الكاذب
  ],
  // ── Currency counterfeiting ──────────────────────────────────────────────
  "تزييف عملة": [
    { lawSlug: "criminal-law-1991", articleNumber: "117" }, // تزييف العملة
    { lawSlug: "criminal-law-1991", articleNumber: "118" }, // تزييف طوابع الإيرادات
    { lawSlug: "criminal-law-1991", articleNumber: "119" }, // صنع أدوات التزييف
    { lawSlug: "criminal-law-1991", articleNumber: "120" }, // صنع وتزييف الأختام الرسمية
  ],
  // ── Religious offences ───────────────────────────────────────────────────
  "إهانة دين": [
    { lawSlug: "criminal-law-1991", articleNumber: "125" }, // إهانة العقائد الدينية
    { lawSlug: "criminal-law-1991", articleNumber: "126" }, // تكفير الأشخاص
    { lawSlug: "criminal-law-1991", articleNumber: "127" }, // تدنيس أماكن العبادة
    { lawSlug: "criminal-law-1991", articleNumber: "128" }, // التعدي على الموتى والقبور
  ],
  // ── Homicide-related ─────────────────────────────────────────────────────
  "إجهاض": [
    { lawSlug: "criminal-law-1991", articleNumber: "135" }, // الإجهاض
    { lawSlug: "criminal-law-1991", articleNumber: "136" }, // الفعل المؤدي إلى الإجهاض
    { lawSlug: "criminal-law-1991", articleNumber: "137" }, // تسبيب موت الجنين
  ],
  // ── Threats / coercion ───────────────────────────────────────────────────
  "تهديد": [
    { lawSlug: "criminal-law-1991", articleNumber: "144" }, // الإرهاب (تهديد وإكراه)
  ],
  // ── Sexual offences ──────────────────────────────────────────────────────
  "زنا": [
    { lawSlug: "criminal-law-1991", articleNumber: "145" }, // الزنا
    { lawSlug: "criminal-law-1991", articleNumber: "146" }, // عقوبة الزنا
  ],
  "لواط": [
    { lawSlug: "criminal-law-1991", articleNumber: "148" }, // اللواط
  ],
  "اغتصاب": [
    { lawSlug: "criminal-law-1991", articleNumber: "149" }, // الاغتصاب
  ],
  "أفعال فاحشة": [
    { lawSlug: "criminal-law-1991", articleNumber: "151" }, // الأفعال الفاحشة والتحرش الجنسي
    { lawSlug: "criminal-law-1991", articleNumber: "152" }, // الأفعال الفاضحة
    // Art. 153 (المواد والعروض المخلة بالآداب) removed from automatic concept link
    // (Commit 42 Change C) — the article remains in the DB; only the automatic
    // link from "أفعال فاحشة" is removed so it no longer surfaces automatically.
  ],
  "دعارة": [
    { lawSlug: "criminal-law-1991", articleNumber: "154" }, // ممارسة الدعارة
    { lawSlug: "criminal-law-1991", articleNumber: "155" }, // إدارة محل للدعارة
    { lawSlug: "criminal-law-1991", articleNumber: "156" }, // الإغواء
  ],
  // ── Honour / reputation ──────────────────────────────────────────────────
  "قذف": [
    { lawSlug: "criminal-law-1991", articleNumber: "157" }, // القذف
  ],
  "إشانة سمعة": [
    { lawSlug: "criminal-law-1991", articleNumber: "159" }, // إشانة السمعة
  ],
  "إساءة وسباب": [
    { lawSlug: "criminal-law-1991", articleNumber: "160" }, // الإساءة والسباب
  ],
  // ── Liberty ──────────────────────────────────────────────────────────────
  "خطف": [
    { lawSlug: "criminal-law-1991", articleNumber: "162" }, // الخطف
  ],
  "استدراج": [
    { lawSlug: "criminal-law-1991", articleNumber: "161" }, // الاستدراج
  ],
  "انتهاك خصوصية": [
    { lawSlug: "criminal-law-1991", articleNumber: "166" }, // انتهاك الخصوصية
  ],
  // ── Hiraba ───────────────────────────────────────────────────────────────
  "حرابة": [
    { lawSlug: "criminal-law-1991", articleNumber: "167" }, // الحرابة
    { lawSlug: "criminal-law-1991", articleNumber: "168" }, // عقوبة الحرابة
  ],
  // ── Financial ────────────────────────────────────────────────────────────
  "صك مردود": [
    { lawSlug: "criminal-law-1991", articleNumber: "179" }, // إعطاء صك مردود
  ],
  // Commit 48: research-only variants for open-point cards
  "صك:فحص:رصيد": [
    { lawSlug: "criminal-law-1991", articleNumber: "179", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  "صك:فحص:سبب": [
    { lawSlug: "criminal-law-1991", articleNumber: "179", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // ── State security (treason / espionage-adjacent) ────────────────────────
  "خيانة الدولة": [
    { lawSlug: "criminal-law-1991", articleNumber: "52" },  // التعامل مع دولة معادية
    { lawSlug: "criminal-law-1991", articleNumber: "54" },  // السماح بهرب أسرى الحرب أو مساعدتهم
    { lawSlug: "criminal-law-1991", articleNumber: "57" },  // دخول وتصوير المناطق العسكرية
    { lawSlug: "criminal-law-1991", articleNumber: "57أ" }, // الإضرار بالاقتصاد الوطني
  ],
  // ── Incitement / sedition ─────────────────────────────────────────────────
  "تحريض": [
    { lawSlug: "criminal-law-1991", articleNumber: "58" },  // التحريض على التمرد
    { lawSlug: "criminal-law-1991", articleNumber: "59" },  // التحريض على الهرب من الخدمة العسكرية
    { lawSlug: "criminal-law-1991", articleNumber: "61" },  // التدريب غير المشروع
    { lawSlug: "criminal-law-1991", articleNumber: "62" },  // إثارة التذمر بين القوات
    { lawSlug: "criminal-law-1991", articleNumber: "63" },  // الدعوة لمعارضة السلطة بالعنف
    { lawSlug: "criminal-law-1991", articleNumber: "64" },  // إثارة الكراهية ضد الطوائف
  ],
  // ── Criminal organizations ────────────────────────────────────────────────
  // Renamed from "إرهاب" to avoid collision with Art. 144 (الإرهاب = تهديد).
  "منظمة إجرامية": [
    { lawSlug: "criminal-law-1991", articleNumber: "65" },  // منظمات وجماعات الإجرام والإرهاب
  ],
  // ── Environmental pollution ───────────────────────────────────────────────
  "تلويث": [
    { lawSlug: "criminal-law-1991", articleNumber: "70" },  // تلويث موارد المياه
    { lawSlug: "criminal-law-1991", articleNumber: "71" },  // تلويث البيئة
  ],
  // ── Endangerment / criminal negligence / public nuisance ─────────────────
  "تعريض للخطر": [
    { lawSlug: "criminal-law-1991", articleNumber: "72" },  // تعريض وسائل المواصلات للخطر
    { lawSlug: "criminal-law-1991", articleNumber: "73" },  // التوقف عن الخدمة مما يسبب خطراً
    { lawSlug: "criminal-law-1991", articleNumber: "74" },  // الإهمال الذي يسبب خطراً على الناس أو الأموال
    { lawSlug: "criminal-law-1991", articleNumber: "75" },  // الامتناع عن المساعدة الضرورية
    { lawSlug: "criminal-law-1991", articleNumber: "76" },  // الإخلال بالالتزام تجاه شخص عاجز
    { lawSlug: "criminal-law-1991", articleNumber: "77" },  // الإزعاج العام
  ],
  // ── Commercial fraud / adulteration ─────────────────────────────────────
  "غش تجاري": [
    { lawSlug: "criminal-law-1991", articleNumber: "82" },  // بيع أطعمة ضارة
    { lawSlug: "criminal-law-1991", articleNumber: "83" },  // غش الأطعمة
    { lawSlug: "criminal-law-1991", articleNumber: "84" },  // غش الأدوية
    { lawSlug: "criminal-law-1991", articleNumber: "85" },  // بيع الميتة
    { lawSlug: "criminal-law-1991", articleNumber: "86" },  // عرض طعام أو شراب محرم
    { lawSlug: "criminal-law-1991", articleNumber: "121" }, // التعامل بوحدات غير صحيحة للوزن أو الكيل
  ],
  // ── Animal cruelty ────────────────────────────────────────────────────────
  "قسوة على حيوان": [
    { lawSlug: "criminal-law-1991", articleNumber: "87" },  // القسوة على الحيوان
  ],
  // ── Abuse of authority (official misconduct) ─────────────────────────────
  "إساءة استخدام السلطة": [
    { lawSlug: "criminal-law-1991", articleNumber: "88أ" }, // إساءة استغلال الوظائف — rank-1 (moved from رشوة)
    { lawSlug: "criminal-law-1991", articleNumber: "89" },  // الموظف العام يخالف القانون بقصد الإضرار أو الحماية
    { lawSlug: "criminal-law-1991", articleNumber: "90" },  // إساءة استعمال سلطة الاتهام
    { lawSlug: "criminal-law-1991", articleNumber: "91" },  // الموظف العام يمتنع عن القبض أو يعين على الهرب
    { lawSlug: "criminal-law-1991", articleNumber: "92" },  // شراء الموظف العام في مال يشرف على بيعه
  ],
  // ── Obstructing public officers ──────────────────────────────────────────
  "عرقلة موظف عام": [
    { lawSlug: "criminal-law-1991", articleNumber: "94" },  // التخلف عن الحضور لأمر موظف عام
    { lawSlug: "criminal-law-1991", articleNumber: "95" },  // منع تنفيذ التكليف بالحضور
    { lawSlug: "criminal-law-1991", articleNumber: "96" },  // الامتناع عن تسليم مستند
    { lawSlug: "criminal-law-1991", articleNumber: "97" },  // تقديم بيان كاذب لموظف عام
    { lawSlug: "criminal-law-1991", articleNumber: "98" },  // الامتناع عن الإجابة على الأسئلة أو التوقيع
    { lawSlug: "criminal-law-1991", articleNumber: "99" },  // اعتراض الموظف العام أو مقاومته
    { lawSlug: "criminal-law-1991", articleNumber: "100" }, // الامتناع عن مساعدة الموظف العام
    { lawSlug: "criminal-law-1991", articleNumber: "101" }, // مخالفة أمر الإقامة
    { lawSlug: "criminal-law-1991", articleNumber: "102" }, // مخالفة أمر بشأن مال
    { lawSlug: "criminal-law-1991", articleNumber: "103" }, // تهديد الموظف العام
  ],
  // ── Obstruction of justice ────────────────────────────────────────────────
  "عرقلة العدالة": [
    { lawSlug: "criminal-law-1991", articleNumber: "106" }, // إتلاف البينة أو إخفاؤها
    { lawSlug: "criminal-law-1991", articleNumber: "107" }, // التستر على الجاني أو إيواؤه
    { lawSlug: "criminal-law-1991", articleNumber: "108" }, // قبول جزاء لحماية الجاني من العقاب
    { lawSlug: "criminal-law-1991", articleNumber: "109" }, // مقاومة القبض المشروع أو تحرير موقوف
    { lawSlug: "criminal-law-1991", articleNumber: "110" }, // مقاومة الشخص عند القبض عليه أو هربه
    { lawSlug: "criminal-law-1991", articleNumber: "112" }, // إقامة دعاوى لحماية مدين أو حرمان دائنين
    { lawSlug: "criminal-law-1991", articleNumber: "115" }, // التأثير على سير العدالة
    { lawSlug: "criminal-law-1991", articleNumber: "116" }, // إساءة الموظف العام في الإجراءات القضائية
  ],
  // ── Attempted suicide / incitement to suicide ────────────────────────────
  "انتحار": [
    { lawSlug: "criminal-law-1991", articleNumber: "133" }, // الشروع في الانتحار
    { lawSlug: "criminal-law-1991", articleNumber: "134" }, // تحريض الصغير أو المجنون على الانتحار
  ],
  // ── Incest ────────────────────────────────────────────────────────────────
  "مواقعة المحارم": [
    { lawSlug: "criminal-law-1991", articleNumber: "150" }, // مواقعة المحارم
  ],
  // ── Forced labour ─────────────────────────────────────────────────────────
  "سخرة": [
    { lawSlug: "criminal-law-1991", articleNumber: "163" }, // السخرة
  ],
  // ── Lurking / preparation for crime ─────────────────────────────────────
  "ترصد": [
    { lawSlug: "criminal-law-1991", articleNumber: "184" }, // الترصد مع القصد الإجرامي
    { lawSlug: "criminal-law-1991", articleNumber: "185" }, // صنع أداة أو الاستعداد لغرض إجرامي
  ],
  // ── War crimes / crimes against humanity ────────────────────────────────
  "جرائم حرب": [
    { lawSlug: "criminal-law-1991", articleNumber: "186" }, // الجرائم ضد الإنسانية
    { lawSlug: "criminal-law-1991", articleNumber: "187" }, // جرائم الإبادة الجماعية
    { lawSlug: "criminal-law-1991", articleNumber: "188" }, // جرائم الحرب ضد الأشخاص
    { lawSlug: "criminal-law-1991", articleNumber: "189" }, // جرائم الحرب ضد الممتلكات
    { lawSlug: "criminal-law-1991", articleNumber: "190" }, // جرائم الحرب ضد العمليات الإنسانية
    { lawSlug: "criminal-law-1991", articleNumber: "191" }, // جرائم الحرب بأساليب القتال المحظورة
    { lawSlug: "criminal-law-1991", articleNumber: "192" }, // جرائم الحرب باستخدام أسلحة محظورة
  ],
  // Commit 36: fire-damage abstain fallback — discuss-only path (Art. 182 lives in the card).
  // Empty here so the primary laws array stays empty; the article is shown via DISCUSS_CONCEPT_TO_ARTICLES.
  "إتلاف:بيّنة": [],
  // Commit 38: accident / necessity discuss-only cards — no primary laws.
  "إباحة:عرضي": [],
  "إباحة:ضرورة": [],
  // Commit 39: participation open-point card — discuss-only (Arts. 21/22 shown via card).
  "اشتراك:فحص": [],
  // Commit 52: admin appointment review card — discuss-only (CARD_ONLY; no primary articles).
  "قرار:مشروعية": [],
  // Commit 40: negligence open-point for قتل خطأ — discuss-only (Arts. 16/132 shown via card).
  "إهمال:فحص:قتل": [],
  // Commit 41: hadd-theft review card — fires when all five preconditions stated explicitly.
  "حد:مراجعة": [],
  // Commit 41: hiraba examination card — robbery with weapon in public place.
  "حرابة:فحص": [],
  // Commit 41: extortion attempt — delivery did not occur.
  "شروع:ابتزاز": [
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "176" },
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
  ],
};

// Articles surfaced as open points for the lawyer when the LLM signals a
// discuss concept. These are fetched separately and never appear in `laws`.
export const DISCUSS_CONCEPT_TO_ARTICLES: Record<string, ConceptArticleEntry[]> = {
  "قتل عمد": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },  // تعريف الشروع
    { lawSlug: "criminal-law-1991", articleNumber: "20" },  // العقوبة على الشروع
    { lawSlug: "criminal-law-1991", articleNumber: "130" }, // القتل العمد
  ],
  // Narcotics intent: shown when intentUnknown=true (bare possession, no stated intent)
  "مخدرات:قصد الاتجار": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "15" },
  ],
  "مخدرات:قصد التعاطي": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "20" },
  ],
  // Art. 16 (تقديم): shown only when supply-to-person keywords match the facts
  "مخدرات:تقديم": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "16" },
  ],
  // Art. 93: shown as open point when احتيال/انتحال impersonation-gate fires
  "انتحال:موظف": [
    { lawSlug: "criminal-law-1991", articleNumber: "93" },
  ],
  // Homicide intent open point: card covers 130 (عمد) and 131 (شبه عمد) for lawyer
  "قتل:وصف": [
    { lawSlug: "criminal-law-1991", articleNumber: "130" }, // القتل العمد — lawyer investigates
    { lawSlug: "criminal-law-1991", articleNumber: "131" }, // القتل شبه العمد — lawyer investigates
  ],
  // Robbery with wound: Art. 139 open point — laws stay Art. 175 only
  "نهب:جرح": [
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // عقوبة الجراح العمد
  ],
  // Hadd theft: always an open point — hadd is never asserted by the tool
  "سرقة:حد": [
    { lawSlug: "criminal-law-1991", articleNumber: "170" }, // السرقة الحدية
    { lawSlug: "criminal-law-1991", articleNumber: "171" }, // عقوبة السرقة الحدية
    { lawSlug: "criminal-law-1991", articleNumber: "172" }, // مسقطات عقوبة الحد
    { lawSlug: "criminal-law-1991", articleNumber: "173" }, // عقوبة السرقة عند سقوط الحد
  ],
  // Attempted-murder open-point cards (C18) — weapon + 5 methods, all → Arts. 19/20/130
  "شروع:سلاح": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "130" },
  ],
  "شروع:خنق": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "130" },
  ],
  "شروع:سم": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "130" },
  ],
  "شروع:حرق": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "130" },
  ],
  "شروع:إغراق": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "130" },
  ],
  "شروع:ذبح": [
    { lawSlug: "criminal-law-1991", articleNumber: "19" },
    { lawSlug: "criminal-law-1991", articleNumber: "20" },
    { lawSlug: "criminal-law-1991", articleNumber: "130" },
  ],
  // Change 1: injury-description open point — no stated wound after lethal method.
  // Both articles are "for investigation, not classification".
  "إصابة:وصف": [
    { lawSlug: "criminal-law-1991", articleNumber: "139" },
    { lawSlug: "criminal-law-1991", articleNumber: "142" },
  ],
  // Commit 33: serious-injury review — bone fracture or hot/caustic liquid; research only.
  "إصابة:مراجعة": [
    { lawSlug: "criminal-law-1991", articleNumber: "139" },
    { lawSlug: "criminal-law-1991", articleNumber: "142" },
  ],
  // Commit 35: negligence/causation open point — جرح خطأ with serious injury but no deliberate act.
  "إهمال:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "16" },
    { lawSlug: "criminal-law-1991", articleNumber: "142" },
  ],
  // Commit 36: fire-damage abstain fallback — research-only, no primary classification.
  "إتلاف:بيّنة": [
    { lawSlug: "criminal-law-1991", articleNumber: "182" },
  ],
  // Commit 37: threat without money demand — Art. 144 open point; Art. 160 as fallback.
  "تهديد:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "144" },
    { lawSlug: "criminal-law-1991", articleNumber: "160" },
  ],
  // Commit 38: accidental damage — Art. 16 (accident) + Art. 182 (destruction) for comparison.
  "إباحة:عرضي": [
    { lawSlug: "criminal-law-1991", articleNumber: "16" },
    { lawSlug: "criminal-law-1991", articleNumber: "182" },
  ],
  // Commit 38: necessity — Art. 15 (necessity) + Art. 182 (destruction) for comparison.
  "إباحة:ضرورة": [
    { lawSlug: "criminal-law-1991", articleNumber: "15" },
    { lawSlug: "criminal-law-1991", articleNumber: "182" },
  ],
  // Commit 39: participation — Arts. 21 (criminal participation) and 22 (accessory).
  "اشتراك:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "21", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
    { lawSlug: "criminal-law-1991", articleNumber: "22", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 40: negligence / causation open point for قتل خطأ — Art. 16 (accident) + Art. 132.
  "إهمال:فحص:قتل": [
    { lawSlug: "criminal-law-1991", articleNumber: "16" },
    { lawSlug: "criminal-law-1991", articleNumber: "132" },
  ],
  // Commit 41: hadd-theft review — Arts. 170/172/174 for lawyer examination.
  "حد:مراجعة": [
    { lawSlug: "criminal-law-1991", articleNumber: "170" },
    { lawSlug: "criminal-law-1991", articleNumber: "172" },
    { lawSlug: "criminal-law-1991", articleNumber: "174" },
  ],
  // Commit 41: hiraba examination card — Arts. 167/168.
  "حرابة:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "167" },
    { lawSlug: "criminal-law-1991", articleNumber: "168" },
  ],
  // Commit 42: lab pending — substance identity not yet confirmed.
  "مخدرات:معمل": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "12" },
  ],
  // Commit 42: knowledge examination — stolen-goods variant.
  "علم:فحص:مسروق": [
    { lawSlug: "criminal-law-1991", articleNumber: "181" },
  ],
  // Commit 42: knowledge examination — narcotics variant.
  "علم:فحص:مخدرات": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "12" },
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "15" },
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "20" },
  ],
  // Commit 42: consent and coercion examination.
  "رضا:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "149" },
    { lawSlug: "criminal-law-1991", articleNumber: "151" },
  ],
  // Commit 42: review between Arts. 151 and 152 (obscene acts vs. indecent acts).
  "فاحشة:مراجعة": [
    { lawSlug: "criminal-law-1991", articleNumber: "151" },
    { lawSlug: "criminal-law-1991", articleNumber: "152" },
  ],
  // Commit 46: civil/abstain + entrustment → Art. 177 as research-only open point.
  "أمانة:مدني": [
    { lawSlug: "criminal-law-1991", articleNumber: "177", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 50: mere non-return examine card → Art. 177 research-only.
  "أمانة:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "177", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 48: cheque dishonour open-point cards → Art. 179 research-only.
  "صك:فحص:رصيد": [
    { lawSlug: "criminal-law-1991", articleNumber: "179", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  "صك:فحص:سبب": [
    { lawSlug: "criminal-law-1991", articleNumber: "179", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 49: authorization-dispute forgery open-point card → Arts. 122/123 research-only.
  "تزوير:فحص": [
    { lawSlug: "criminal-law-1991", articleNumber: "122", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
    { lawSlug: "criminal-law-1991", articleNumber: "123", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 49: public-official false-entry open-point card → Art. 124 research-only.
  "تزوير:موظف": [
    { lawSlug: "criminal-law-1991", articleNumber: "124", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Commit 52: admin appointment review card — CARD_ONLY, no articles fetched via this map.
  "قرار:مشروعية": [],
  // Case 7 fix: qadhf kept (facts impute zina/liwat/lineage) → conditions card with
  // the remission grounds (Art. 158) and the reputation alternative (Art. 159).
  "قذف:شروط": [
    { lawSlug: "criminal-law-1991", articleNumber: "158", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
    { lawSlug: "criminal-law-1991", articleNumber: "159", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Case 7 fix: LLM said قذف but the facts carry no such imputation → Art. 157 dropped,
  // primary becomes Art. 160; Art. 159 shown as the alternative to examine.
  "قذف:تحويل": [
    { lawSlug: "criminal-law-1991", articleNumber: "159", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Reputation/insult alternatives: whichever of 159/160 the classifier picks,
  // the other is shown as an alternative to examine.
  "سمعة:بديل": [
    { lawSlug: "criminal-law-1991", articleNumber: "159", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  "سباب:بديل": [
    { lawSlug: "criminal-law-1991", articleNumber: "160", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
  // Case 3 fix: blunt instrument + no stated intent → عمد vs شبه عمد is open.
  "جراح:قصد": [
    { lawSlug: "criminal-law-1991", articleNumber: "139", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
    { lawSlug: "criminal-law-1991", articleNumber: "140", statusNoteOverride: "معروضة للبحث، لا للتصنيف" },
  ],
};

const DISCUSS_CONCEPT_LABEL: Record<string, string> = {
  "قتل عمد": "الشروع في القتل العمد — نقطة مفتوحة للمحامي",
  "مخدرات:قصد الاتجار": "المادة 15 — الاتجار في المواد المخدرة",
  "مخدرات:قصد التعاطي": "المادة 20 — الحيازة بقصد التعاطي",
  "مخدرات:تقديم": "المادة 16 — تقديم المخدرات لشخص آخر",
  "انتحال:موظف": "انتحال صفة الموظف العام (المادة ٩٣)",
  "قتل:وصف": "وصف القتل: عمد أم شبه عمد — نقطة مفتوحة للمحامي",
  "نهب:جرح": "الجرح المصاحب للنهب (المادة ١٣٩) — نقطة مفتوحة للمحامي",
  "سرقة:حد": "السرقة الحدية — تطبيق المادة 170 رهنٌ بثبوت شروط الحد",
  "قذف:شروط": "القذف الحدي — تطبيق المادة 157 رهنٌ بثبوت شروطه",
  "جراح:قصد": "وصف الجرح: عمد أم شبه عمد — نقطة مفتوحة للمحامي",
  "سمعة:بديل": "إشانة السمعة (المادة 159) — بديل يُفحص",
  "سباب:بديل": "الإساءة والسباب (المادة 160) — بديل يُفحص",
  "قذف:تحويل": "إشانة السمعة (المادة 159) — بديل يُفحص، ولا قذف حدي",
  "شروع:سلاح":  "احتمال الشروع في القتل — نقطة مفتوحة للمحامي",
  "شروع:خنق":   "احتمال الشروع في القتل — نقطة مفتوحة للمحامي",
  "شروع:سم":    "احتمال الشروع في القتل — نقطة مفتوحة للمحامي",
  "شروع:حرق":   "احتمال الشروع في القتل — نقطة مفتوحة للمحامي",
  "شروع:إغراق": "احتمال الشروع في القتل — نقطة مفتوحة للمحامي",
  "شروع:ذبح":   "احتمال الشروع في القتل — نقطة مفتوحة للمحامي",
  "إصابة:وصف":    "وصف الإصابة: جراح أم أذى — نقطة مفتوحة للمحامي",
  "إصابة:مراجعة": "مراجعة وصف الإصابة — نقطة مفتوحة للمحامي",
  "إهمال:فحص":    "فحص الإهمال والسببية والحادث العرضي — نقطة مفتوحة للمحامي",
  "إهمال:فحص:قتل": "فحص الإهمال والسببية والحادث العرضي — نقطة مفتوحة للمحامي",
  "إتلاف:بيّنة":  "الإتلاف الجنائي بالنار — احتمال قانوني غير مسند بما يكفي",
  "تهديد:فحص":    "فحص التهديد: ألفاظه وسياقه — نقطة مفتوحة للمحامي",
  "إباحة:عرضي":   "لا تظهر جريمة ظاهراً — فحص الحادث العرضي، نقطة مفتوحة للمحامي",
  "إباحة:ضرورة":  "لا تظهر جريمة ظاهراً — فحص الضرورة والتناسب، نقطة مفتوحة للمحامي",
  "اشتراك:فحص":   "تعدد الأشخاص في الواقعة (المادتان ٢١ و٢٢) — فحص دور كل شخص",
  "حد:مراجعة":    "مراجعة شروط السرقة الحدية (المادة ١٧٠) — نقطة مفتوحة للمحامي",
  "حرابة:فحص":    "فحص الحرابة (المادة ١٦٧) — نقطة مفتوحة للمحامي",
  "مخدرات:معمل":  "مادة مشتبه بها قيد الفحص المعملي — نقطة مفتوحة للمحامي",
  "علم:فحص:مسروق":   "فحص العلم بطبيعة المال أو المادة — نقطة مفتوحة للمحامي",
  "علم:فحص:مخدرات":  "فحص العلم بطبيعة المال أو المادة — نقطة مفتوحة للمحامي",
  "رضا:فحص":      "فحص الرضا والإكراه — نقطة مفتوحة للمحامي",
  "فاحشة:مراجعة": "مراجعة الوصف بين المادتين ١٥١ و١٥٢ — نقطة مفتوحة للمحامي",
  "أمانة:مدني": "خيانة الأمانة أم نزاع تعاقدي — نقطة مفتوحة للمحامي",
  "أمانة:فحص": "عدم ردّ مال مسلَّم لغرض محدد — فحص عناصر خيانة الأمانة",
  "صك:فحص:رصيد": "صك مردود بسبب الرصيد — فحص العلم",
  "صك:فحص:سبب":  "صك مردود بأمر وقف الصرف — فحص السبب المعقول",
  "تزوير:فحص":   "إكمال محرر أو تغيير مضمونه مع نزاع على الإذن — فحص قانوني",
  "تزوير:موظف":  "تدوين وقائع غير صحيحة أو إغفال وقائع حقيقية بواسطة موظف عام — للبحث",
  "قرار:مشروعية": "مراجعة مشروعية القرار الإداري — نقطة مفتوحة للمحامي",
};

const DISCUSS_CONCEPT_DESC: Record<string, string> = {
  "قتل عمد": "ليست هذه تصنيفاً. قد تُثار مسألة الشروع في القتل بحسب ما يثبت من قصد الجاني — وإثباتها أو نفيها مهمة المحامي، والفصل فيها للمحكمة.",
  "مخدرات:قصد الاتجار": "الوقائع تثبت الحيازة. تطبيق المادة 15 (الاتجار) رهنٌ بإثبات قصد الاتجار — وإثباته أو نفيه مهمة المحامي، والفصل فيه للمحكمة.",
  "مخدرات:قصد التعاطي": "الوقائع تثبت الحيازة. تطبيق المادة 20 (التعاطي الشخصي) رهنٌ بإثبات القصد الشخصي — وإثباته أو نفيه مهمة المحامي، والفصل فيه للمحكمة.",
  "مخدرات:تقديم": "الوقائع تشير إلى تقديم مواد مخدرة لشخص آخر. تطبيق المادة 16 (تقديم المخدرات) رهنٌ بإثبات التسليم المباشر — وإثباته أو نفيه مهمة المحامي، والفصل فيه للمحكمة.",
  "انتحال:موظف": "تفيد الوقائع أن المتهم ادّعى صفة موظف عام للحصول على المال. الوصف الأساسي هو الاحتيال (المادة ١٧٨). على المحامي أن يبحث: هل يقوم انتحال الصفة جريمةً مستقلة إلى جانب الاحتيال، أم هو مجرد وسيلة له؟ والمادة ٩٣ تشترط سوء القصد.",
  "قتل:وصف": "ليست هذه تصنيفاً. تفيد الوقائع وقوع وفاة نتيجة فعل المتهم دون ما يبيّن قصد القتل. يكون القتل عمداً إذا قصده الجاني أو قصد الفعل وكان الموت نتيجة راجحة له (المادة ١٣٠)، وشبه عمد إذا لم يقصد القتل ولم يكن الموت نتيجة راجحة لفعله (المادة ١٣١). تحديد الوصف بحسب ما يثبت من القصد والأداة وموضع الإصابة مهمة المحامي، والفصل فيه للمحكمة.",
  "نهب:جرح": "تفيد الوقائع أن النهب صاحبه جرح. الوصف الأساسي هو النهب (المادة ١٧٥)، وبندها الثاني يجعل عقوبته «بالإضافة إلى أي عقوبة أخرى مقررة لما يترتب على فعله»، فقد تنطبق المادتان معاً. إثبات الجرح وتحديد وصفه مهمة المحامي، والفصل فيه للمحكمة.",
  "سرقة:حد": "الوقائع تثبت السرقة. تطبيق عقوبة الحد (المادة 170) مشروط بثبوت شروطه، ومنها أخذ المال خفية من حرزه وبلوغه النصاب — وإثبات ذلك أو نفيه مهمة المحامي، والفصل فيه للمحكمة.",
  "قذف:شروط": "ليست هذه تصنيفاً ولا تقريراً بثبوت القذف. تذكر الوقائع رمياً قد يدخل في المادة 157، وتطبيق الحد مشروط بثبوت: أن الرمي كان بالزنا أو اللواط أو نفي النسب صراحةً أو دلالةً، وأنه كذب، وأن المقذوف عفيف بمفهوم البند (2) من المادة، وثبوت صدور القول بالبينة. وتُراجع مسقطات العقوبة في المادة 158 (التقاذف، والعفو، واللعان، وكون المقذوف فرعاً للقاذف)؛ فإن سقط الحد أو لم تكتمل شروطه تُبحث إشانة السمعة (المادة 159). الإثبات والنفي مهمة المحامي، والفصل للمحكمة.",
  "قذف:تحويل": "لم تُعرض المادة 157 (القذف الحدي) لأن الوقائع لا تذكر رمياً بالزنا أو اللواط أو نفي النسب، وهذه وحدها محل حد القذف؛ فوصف شخص بالسرقة أو الكذب أو نحوهما ليس قذفاً. عُرضت المادة 160 (الإساءة والسباب) للبحث، وتُفحص المادة 159 (إشانة السمعة) إذا ثبت أن الجاني نسب إلى المجني عليه واقعة معينة أمام الغير قاصداً الإضرار بسمعته. التكييف والإثبات مهمة المحامي، والفصل للمحكمة.",
  "جراح:قصد": "ليست هذه تصنيفاً. تفيد الوقائع ضربة بأداة غير قاتلة بطبيعتها نتج عنها جرح، دون ما يبيّن القصد. ويكون الجرح عمداً أو شبه عمد بحسب ما يُراعى في التمييز بين أنواع القتل (المادة ١٣٨/٢): القصد، وطبيعة الأداة، وموضع الضربة، وشدتها، وتكرارها. فتُعرض المادة ١٣٩ (الجراح العمد) والمادة ١٤٠ (الجراح شبه العمد) للبحث، ويُستعان بالتقرير الطبي في تحديد الجرح ونوعه. إثبات ذلك أو نفيه مهمة المحامي، والفصل فيه للمحكمة.",
  "سمعة:بديل": "ليست هذه تصنيفاً. إذا ثبت أن الجاني لم يكتفِ بتوجيه الإهانة، بل نسب إلى المجني عليه واقعة معينة أو تقويماً لسلوكه ونقلها إلى الغير قاصداً الإضرار بسمعته، تُبحث المادة 159 (إشانة السمعة) بدلاً من المادة 160 أو معها، مع مراعاة الحالات التي لا يُعد فيها الشخص قاصداً الإضرار (المادة 159/2). التكييف والإثبات مهمة المحامي، والفصل للمحكمة.",
  "سباب:بديل": "ليست هذه تصنيفاً. إذا ثبت أن القول إهانة أو سباب موجّه إلى الشخص دون إسناد واقعة معينة إليه، فالأقرب المادة 160 (الإساءة والسباب)، وهي لما لا يبلغ درجة القذف أو إشانة السمعة. التمييز بين المادتين بحسب مضمون القول وسياقه وقصد قائله مهمة المحامي، والفصل للمحكمة.",
  // ── Attempted-murder open-point cards: base paragraph only (no evidence line) ──
  "شروع:سلاح":  "ليست هذه تصنيفاً. استعمال وسيلة قاتلة بطبيعتها يفتح باب فحص الشروع في القتل ولا يثبته. لا بد من فحص القصد وبدء التنفيذ والأدلة المحيطة بالفعل. إثبات ذلك أو نفيه مهمة المحامي، والتكييف النهائي من اختصاص المحكمة.",
  "شروع:خنق":   "ليست هذه تصنيفاً. استعمال وسيلة قاتلة بطبيعتها يفتح باب فحص الشروع في القتل ولا يثبته. لا بد من فحص القصد وبدء التنفيذ والأدلة المحيطة بالفعل. إثبات ذلك أو نفيه مهمة المحامي، والتكييف النهائي من اختصاص المحكمة.",
  "شروع:سم":    "ليست هذه تصنيفاً. استعمال وسيلة قاتلة بطبيعتها يفتح باب فحص الشروع في القتل ولا يثبته. لا بد من فحص القصد وبدء التنفيذ والأدلة المحيطة بالفعل. إثبات ذلك أو نفيه مهمة المحامي، والتكييف النهائي من اختصاص المحكمة.",
  "شروع:حرق":   "ليست هذه تصنيفاً. استعمال وسيلة قاتلة بطبيعتها يفتح باب فحص الشروع في القتل ولا يثبته. لا بد من فحص القصد وبدء التنفيذ والأدلة المحيطة بالفعل. إثبات ذلك أو نفيه مهمة المحامي، والتكييف النهائي من اختصاص المحكمة.",
  "شروع:إغراق": "ليست هذه تصنيفاً. استعمال وسيلة قاتلة بطبيعتها يفتح باب فحص الشروع في القتل ولا يثبته. لا بد من فحص القصد وبدء التنفيذ والأدلة المحيطة بالفعل. إثبات ذلك أو نفيه مهمة المحامي، والتكييف النهائي من اختصاص المحكمة.",
  "شروع:ذبح":   "ليست هذه تصنيفاً. استعمال وسيلة قاتلة بطبيعتها يفتح باب فحص الشروع في القتل ولا يثبته. لا بد من فحص القصد وبدء التنفيذ والأدلة المحيطة بالفعل. إثبات ذلك أو نفيه مهمة المحامي، والتكييف النهائي من اختصاص المحكمة.",
  "إصابة:وصف":    "ليست هذه تصنيفاً. لا تذكر الوقائع جرحاً ولا إصابة موصوفة. تحديد الوصف بين تسبيب الجراح العمد (المادة ١٣٩) والأذى (المادة ١٤٢) يتوقف على الإصابة الثابتة بالتقرير الطبي، وإثباتها مهمة المحامي، والفصل فيها للمحكمة.",
  "إصابة:مراجعة": "ليست هذه تصنيفاً نهائياً. عُرضت المادة ١٣٩ مبدئياً لأن الوقائع تذكر إصابة جسيمة (كسراً أو حرقاً) دون وصف طبي كافٍ. تحديد الوصف بين تسبيب الجراح (المادة ١٣٩) والأذى (المادة ١٤٢) يتوقف على التقرير الطبي وطبيعة الإصابة ومآلها، وإثباتها مهمة المحامي، والفصل فيها للمحكمة.",
  "إهمال:فحص": "ليست هذه تصنيفاً نهائياً. عُرضت المادة ١٤١ مبدئياً لأن الوقائع تذكر إصابة دون فعل اعتداء عمدي. إثبات الجراح الخطأ يتوقف على ثبوت الإهمال أو عدم الاحتياط، وعلى علاقة السببية بين الفعل والإصابة؛ وقد ينتفي الخطأ أصلاً إذا توافرت شروط الحادث العرضي (المادة ١٦). ووصف الإصابة بين الجراح والأذى (المادة ١٤٢) يتوقف على التقرير الطبي. التحقق من ذلك مهمة المحامي، والفصل فيه للمحكمة.",
  "إهمال:فحص:قتل": "ليست هذه تصنيفاً نهائياً. عُرضت المادة ١٣٢ مبدئياً لأن الوقائع تشير إلى قتل خطأ. إثبات القتل الخطأ يتوقف على ثبوت الإهمال أو عدم الاحتياط، وعلى علاقة السببية بين الفعل والوفاة؛ وقد ينتفي الخطأ أصلاً إذا توافرت شروط الحادث العرضي (المادة ١٦). التحقق من ذلك مهمة المحامي، والفصل فيه للمحكمة.",
  "إتلاف:بيّنة": "ليست هذه تصنيفاً. تذكر الوقائع حريقاً وإتلافاً، ولا تذكر ما يُسند الفعل إلى شخص معيّن إسناداً كافياً. عُرضت المادة ١٨٢ بوصفها احتمالاً قانونياً للبحث لا تكييفاً. وجود المتهم قرب المكان أو وجود دافع لا يكفيان وحدهما لإثبات الإحراق. تقدير كفاية البيّنة مهمة المحامي، والفصل فيها للمحكمة.",
  "تهديد:فحص": "ليست هذه تصنيفاً نهائياً. عُرضت المادة ١٤٤ مبدئياً لأن الوقائع تذكر تهديداً دون طلب مال أو سند، فاستُبعد مسار الابتزاز (المادة ١٧٦) من التصنيف. إثبات الإرهاب يتوقف على ألفاظ التهديد وسياقها وجدّيتها وأثرها في المهدَّد، وقد لا يتجاوز الفعل حدّ الإساءة (المادة ١٦٠). التحقق من ذلك مهمة المحامي، والفصل فيه للمحكمة.",
  "إباحة:عرضي": "ليست هذه تصنيفاً ولا إعلان براءة. لا تذكر الوقائع قصداً جنائياً، وتشير إلى أن الفعل ربما كان حادثاً عرضياً. عُرضت المادة ١٦ (الحادث العرضي) والمادة ١٨٢ (الإتلاف) للمقارنة لا للتكييف. إثبات انعدام القصد أو توافره مهمة المحامي، والفصل فيه للمحكمة.",
  "إباحة:ضرورة": "ليست هذه تصنيفاً ولا إعلان براءة. تذكر الوقائع فعلاً يُعدّ في ذاته إتلافاً، غير أن السياق يشير إلى احتمال الضرورة. عُرضت المادة ١٥ (حالة الضرورة) والمادة ١٨٢ (الإتلاف) للمقارنة لا للتكييف. إثبات شروط الضرورة وتناسب الفعل مع الخطر مهمة المحامي، والفصل فيه للمحكمة.",
  "اشتراك:فحص": "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تنسب الوقائع أفعالاً متصلة بالواقعة إلى أكثر من شخص، ولا يُستنتج من ذلك وجود اتفاق جنائي ولا تساوي المسؤولية. فيُفحص فعل كل شخص على حدة، فعلاً كان أو امتناعاً، وعلمه وقصده، ودوره في التنفيذ أو التحريض أو المعاونة. فإن أُريد بحث المادة ٢١ لزم التحقق من وجود اتفاق جنائي ارتُكبت الجريمة تنفيذاً له؛ وفي غيابه تُبحث مسؤولية كل شخص عن فعله وفق المادة ٢٢. هذه بطاقة فحص؛ والتحقق من الأدلة للمحامي، والفصل للمحكمة.",
  "حد:مراجعة": "ليست هذه تصنيفاً نهائياً. ذكرت الوقائع صراحةً شروط السرقة الحدية الخمسة. تطبيق عقوبة الحد (المادة ١٧٠) يستلزم ثبوتها جميعاً بيقين ودون شبهة، وذلك مهمة المحامي، والفصل فيه للمحكمة. المادة ١٧٢ تُبيّن مسقطات الحد، والمادة ١٧٤ العقوبة التعزيرية عند سقوطه.",
  "حرابة:فحص": "ليست هذه تصنيفاً نهائياً. الوقائع تتضمن نهباً بسلاح في مكان عام، مما يستوجب على المحامي فحص توافر شروط الحرابة وفق المادة ١٦٧. الشرط المحوري هو تعذّر الغوث، أي أن يقع الفعل في موضع لا يستطيع المجني عليه الاستنجاد فيه. إذا لم يثبت هذا الشرط فيبقى الوصف نهباً (المادة ١٧٥). التحقق من ذلك مهمة المحامي، والفصل فيه للمحكمة.",
  "مخدرات:معمل": "مادة مشتبه بها قيد الفحص المعملي. لا تكفي الوقائع الحالية لإثبات طبيعتها أو علم المتهم بمحتويات الحقيبة. يُرجأ التكييف النهائي لحين ورود نتيجة المعمل واستكمال أدلة العلم والحيازة.",
  "علم:فحص:مسروق": "لا تكفي حيازة المال أو المادة، أو استلامها أو حفظها لحساب الغير، وحدها لإثبات علم الشخص بمصدرها غير المشروع أو بطبيعتها المحظورة. ويجب فحص ظروف التسليم، وطبيعة المقابل، وتصرفات المستلم، والقرائن التي قد تثبت العلم الفعلي أو إدراك الاحتمال وقبوله، وفق النص القانوني المنطبق. ولا يُستخلص العلم تلقائياً من انخفاض الثمن أو تقاضي أجر أو عدم السؤال عن المحتويات. كما لا يُعد إنكار العلم دليلاً حاسماً على انتفائه. هذه بطاقة فحص وليست حكماً بثبوت الجريمة أو انتفائها. تقدير الأدلة للمحكمة.",
  "علم:فحص:مخدرات": "لا تكفي حيازة المال أو المادة، أو استلامها أو حفظها لحساب الغير، وحدها لإثبات علم الشخص بمصدرها غير المشروع أو بطبيعتها المحظورة. ويجب فحص ظروف التسليم، وطبيعة المقابل، وتصرفات المستلم، والقرائن التي قد تثبت العلم الفعلي أو إدراك الاحتمال وقبوله، وفق النص القانوني المنطبق. ولا يُستخلص العلم تلقائياً من انخفاض الثمن أو تقاضي أجر أو عدم السؤال عن المحتويات. كما لا يُعد إنكار العلم دليلاً حاسماً على انتفائه. هذه بطاقة فحص وليست حكماً بثبوت الجريمة أو انتفائها. تقدير الأدلة للمحكمة.",
  "رضا:فحص": "يجب التحقق من توافر الرضا الحر المعتبر قانوناً وقت الفعل، ومن أثر التهديد أو الإكراه أو غيرهما من الظروف المؤثرة فيه. ولا يُفترض الرضا من مجرد وجود علاقة سابقة أو دخول المكان طوعاً، كما لا يُشترط إثبات مقاومة جسدية لإثبات انعدام الرضا. يُبحث الوصف القانوني وفق النص النافذ والأدلة المتاحة، ويظل الفصل في الوقائع للمحكمة.",
  "فاحشة:مراجعة": "ليست هذه تصنيفاً نهائياً. عُرضت المادة ١٥١ مبدئياً لأن الوقائع تذكر فعلاً مخلاً بالحياء واقعاً على شخص معيّن؛ ووقوعه في مكان عام أو بغير رضا المجني عليه ظرف مشدِّد داخل المادة ١٥١(٢) لا ناقل إلى المادة ١٥٢. تُعرض المادة ١٥٢ للمراجعة لأنها تتعلق بالفعل الفاضح الذي يسبب مضايقة للشعور العام، ولأن حالتها القانونية متنازع فيها بعد تعديل ٢٠٢٠. التحقق من ذلك مهمة المحامي، والفصل فيه للمحكمة.",
  "أمانة:مدني": "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تذكر الوقائع تسليم مال أو شيء لغرض محدد، وعدم رده أو التصرف فيه. تُبحث خيانة الأمانة وفق المادة ١٧٧ إذا ثبت أن المال سُلّم على سبيل الائتمان، وأن المستلم تصرف فيه بسوء قصد بالمخالفة للغرض الذي سُلّم من أجله، أو أنكر استلامه في ظروف قد تدل على الاستيلاء عليه. أما إذا هلك المال أو خسر أثناء تنفيذ الاتفاق دون تصرف مخالف أو قصد جنائي، فقد يكون النزاع تعاقدياً مدنياً، ولا يكفي مجرد عدم الرد لإثبات خيانة الأمانة. الفاصل ليس عدم الرد وحده، بل طبيعة التسليم، وحدود التصرف المأذون به، وتوافر القصد الجنائي. والتحقق من ذلك مهمة المحامي، والفصل فيه للمحكمة.",
  "أمانة:فحص": "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تذكر الوقائع تسليم مال أو شيء لغرض محدد وعدم ردّه، دون بيان كافٍ لمصيره أو سبب عدم الرد. ومجرد عدم الرد لا يحسم توافر عناصر المادة ١٧٧. يُفحص أساس الائتمان، وحدود الإذن، وأدلة التسليم، وما آل إليه المال، وظروف الامتناع، وما إذا كانت الوقائع تدل على إحدى الصور الواردة في المادة، والقصد أو الإهمال بحسب الصورة محل البحث. ويُراجع تفسير المستلم في ضوء سائر الأدلة؛ فلا يُفترض سوء القصد من عدم الرد وحده، ولا تُستبعد الجريمة لمجرد غموض مصير المال. هذه بطاقة فحص؛ وفحص الأدلة للمحامي، وتقدير ثبوتها والفصل للمحكمة.",
  "تزوير:فحص": "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تذكر الوقائع إكمال محرر أو تغيير مضمونه، مع خلاف حول وجود الإذن أو حدوده. يُبحث مدى انطباق المادة ١٢٢، والعقوبة الواردة بالمادة ١٢٣، بعد التحقق من طبيعة التغيير وجوهريته، وقصد الغش، والغرض من استخدام المحرر لترتيب آثار قانونية. ولا يكفي مجرد تجاوز الإذن لإثبات هذه العناصر.\n\nوتُبحث المادة ١٧٧ بحثاً مشروطاً إذا دلّت الوقائع على ائتمان على حيازة مال أو إدارته وفعل قد يندرج ضمن الأفعال التي يجرّمها النص؛ ولا يُفترض ذلك من مجرد تسليم المحرر أو النزاع على إكماله.\n\nفيُفحص: أصل المحرر، ونطاق الإذن وأدلته، والبيانات التي أُضيفت أو غُيّرت، وتوقيت ذلك، وغرض استخدامه، وتصرفات الأطراف بعده. صحة التوقيع لا تحسم صحة البيانات المضافة، والخلاف حول إذن شفوي لا يثبت الجريمة ولا ينفيها. هذه بطاقة فحص، والتحقق مهمة المحامي، والفصل للمحكمة.",
  "تزوير:موظف": "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تتضمن الوقائع ادعاءً بأن موظفاً عاماً أو مكلفاً بخدمة عامة دوّن عند تحرير مستند وقائع غير صحيحة أو أغفل إثبات وقائع حقيقية. تُعرض المادة ١٢٤ للبحث في صفة الشخص، وصلته بتحرير المستند، وحقيقة الوقائع المدونة أو المغفلة، وعلمه بعدم صحتها أو بإغفالها. ولا يُستخلص العلم من مجرد الصفة الوظيفية أو وجود خطأ في المستند، ولا يُنفى بمجرد إنكار الشخص. هذه بطاقة فحص؛ والتحقق من الأدلة للمحامي، والفصل للمحكمة.",
  "قرار:مشروعية": "تذكر الوقائع تعييناً أو توظيفاً أو ترقيةً لشخص تربطه قرابة بمتخذ القرار، مع الإشارة إلى غياب أحد إجراءات الإعلان أو المنافسة أو المسابقة. تُراجع صلاحية مصدر القرار، والقواعد المنظمة للإجراء، والاستثناءات المقررة فيها، ومدى الالتزام بها. القرابة وحدها لا تحسم عدم المشروعية أو قيام جريمة.",
  "صك:فحص:رصيد": "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تذكر الوقائع صكاً مصرفياً رُدّ بسبب عدم كفاية الرصيد أو عدم قابليته للسحب. ويقتضي بحث المادة ١٧٩(١)(ب) فحص علم الساحب بحالة الرصيد، إلى جانب سائر عناصر الجريمة. فيُراجع سبب الرد المثبت لدى المصرف، وتواريخ تحرير الصك وتسليمه والتاريخ المثبت عليه وتقديمه للصرف، وحركة الحساب والقيود على السحب، وما يثبت علم الساحب بها أو يناقضه. ولا يتعامل المحرك مع مجرد الرد باعتباره إثباتاً حاسماً للعلم، ولا مع قول الساحب إن الرصيد كان موجوداً باعتباره نفياً حاسماً له. هذه بطاقة فحص، والتحقق من الوقائع مهمة المحامي، وتقدير الأدلة والفصل فيها للمحكمة.",
  "صك:فحص:سبب":  "ليست هذه تصنيفاً ولا تقريراً بقيام جريمة. تذكر الوقائع صكاً مصرفياً رُدّ بسبب أمر بوقف صرفه صادر من الساحب أو ممن ينوب عنه. ويقتضي بحث المادة ١٧٩(١)(ج) التحقق مما إذا كان الوقف دون سبب معقول، إلى جانب سائر عناصر الجريمة. فيُبحث السبب الذي يستند إليه الساحب إن ورد، والأدلة عليه، وصلته بالصك والالتزام المقابل، وتوقيت نشوئه أو اكتشافه وإصدار أمر الوقف، وأي مراسلات بشأنه. ولا يُعامل عيب المبيع أو عدم تنفيذ الالتزام أو النزاع العقدي باعتباره تلقائياً سبباً معقولاً أو غير معقول. كما لا يحسم إخطار المستفيد أو عدم إخطاره هذه المسألة وحده. وقد يوجد نزاع مدني حول العقد إلى جانب البحث الجنائي. هذه بطاقة فحص، والتحقق من الوقائع مهمة المحامي، وتقدير معقولية السبب والفصل فيها للمحكمة.",
};

/** Evidence items for شروع:* cards — displayed after a bold "قرائن تُفحص:" label. */
const DISCUSS_CONCEPT_EVIDENCE: Record<string, string> = {
  "شروع:سلاح":  "موضع الإصابة، وطريقة الاعتداء، وشدته، وتكراره، والتهديد السابق، وسائر ظروف الواقعة.",
  "شروع:خنق":   "فقدان الوعي، ومدة الضغط على العنق، واستمرار الاعتداء بعد سقوط المجني عليه.",
  "شروع:سم":    "طبيعة المادة، والجرعة، وطريقة إعطائها، وعلم الجاني بخطورتها.",
  "شروع:حرق":   "موضع الحرق، واتساعه، وهل منع الجاني المجني عليه من النجاة.",
  "شروع:إغراق": "تعمّد إبقاء المجني عليه تحت الماء، وظروف إنقاذه.",
  "شروع:ذبح":   "موضع الإصابة، والأداة، والقصد.",
  "قرار:مشروعية": "تُفحص لائحة التعيين، وقرار التعيين وأسبابه، ومستندات الإعلان والمفاضلة أو سند الاستثناء، والمراسلات المتصلة بالاختيار. وإذا ظهرت قرائن إضافية على مخالفة واجب قانوني بقصد الإضرار أو تحقيق مصلحة غير مشروعة، تُبحث المادة ٨٩ بحسب عناصرها، دون اشتراط مقابل مالي ودون استنتاج القصد من القرابة وحدها.",
};

/** Caution sentences for شروع:* cards that carry one ("ولا يُجزم…" / "ولا يُستنتج…").
 *  Displayed on the line after the evidence items. */
const DISCUSS_CONCEPT_CAUTION: Record<string, string> = {
  "شروع:سلاح":  "ولا يُستنتج الشروع من السلاح أو الجرح وحدهما.",
  "شروع:خنق":   "ولا يُجزم بقصد القتل من فقدان الوعي وحده.",
  "قرار:مشروعية": "هذه بطاقة فحص، وليست حكماً ببطلان القرار أو بثبوت جريمة أو انتفائها. لا تُعرض المادة ٨٩ تلقائياً بسبب هذه البطاقة، ولا يتحول المسار إلى جنائي بمجرد ظهورها. تُراجع شروط الطعن والتظلم ومواعيدهما وفق القانون المنطبق؛ والتحقق مهمة المحامي، والفصل للجهة القضائية المختصة.",
};

const DISCUSS_CONCEPT_CONFLICT_LINE: Record<string, string> = {
  "قرار:مشروعية": "تتعارض الوقائع في إثبات إجراء الإعلان أو المنافسة أو المسابقة أو نفيه؛ ولا يُرجَّح ذلك آلياً، ويُترك ترجيحه للمحامي.",
};

const CARD_ONLY_CONCEPTS = new Set<string>(["قرار:مشروعية"]);

/** PostgREST caps every response at 1,000 rows. Fetching all articles of
 * several laws in one request silently drops everything past row 1,000
 * once those laws together exceed it (e.g. civil-transactions-1984 alone
 * has 819 articles). This reads the same rows page by page, in a stable
 * order, until a short page signals the end. */
const ARTICLE_PAGE_SIZE = 1000;
const ARTICLE_COLUMNS =
  "id, law_id, article_number, title_ar, content_ar, verified, status_note_ar, legal_status";

async function fetchAllArticlesForLaws<T>(
  supabase: SupabaseClient,
  lawIds: string[],
): Promise<T[]> {
  if (!lawIds.length) return [];
  const rows: T[] = [];
  for (let from = 0; ; from += ARTICLE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("articles")
      .select(ARTICLE_COLUMNS)
      .in("law_id", lawIds)
      .order("id", { ascending: true })
      .range(from, from + ARTICLE_PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...(data as T[]));
    if (data.length < ARTICLE_PAGE_SIZE) break;
  }
  return rows;
}

/** Builds a DiscussItem for a civil-path research card by fetching all articles
 * listed in DISCUSS_CONCEPT_TO_ARTICLES[concept] from Supabase.
 * Returns undefined if the concept has no entries or no DB rows are found. */
async function buildCivilDiscussItem(
  concept: string,
  sbClient: SupabaseClient,
): Promise<DiscussItem | undefined> {
  const entries = DISCUSS_CONCEPT_TO_ARTICLES[concept] ?? [];
  if (!entries.length) return undefined;

  const lawSlugs = [...new Set(entries.map((e) => e.lawSlug))];
  const { data: lawRows } = await sbClient
    .from("laws")
    .select("id,slug,title_ar,source_url,verified,status")
    .in("slug", lawSlugs);
  type LawRow = { id: string; slug: string; title_ar: string | null; source_url: string | null; verified: boolean | null; status?: string | null };
  const lawBySlugLocal = new Map<string, LawRow>(
    ((lawRows ?? []) as LawRow[]).map((l) => [l.slug, l]),
  );

  const lawIds = [...lawBySlugLocal.values()].map((l) => l.id);
  const artNums = [...new Set(entries.map((e) => e.articleNumber))];
  const { data: artRows } = await sbClient
    .from("articles")
    .select("id,law_id,article_number,title_ar,content_ar,verified,status_note_ar,legal_status")
    .in("law_id", lawIds)
    .in("article_number", artNums);
  type ArtRow = { id: string; law_id: string; article_number: string | null; title_ar: string | null; content_ar: string | null; verified: boolean | null; status_note_ar: string | null; legal_status: string | null };
  const artByPair = new Map<string, ArtRow>(
    ((artRows ?? []) as ArtRow[]).map((a) => [`${a.law_id}:${(a.article_number ?? "").trim()}`, a]),
  );

  const articles: RetrievedAuthority[] = [];
  for (const entry of entries) {
    const parentLaw = lawBySlugLocal.get(entry.lawSlug);
    if (!parentLaw) continue;
    const art = artByPair.get(`${parentLaw.id}:${entry.articleNumber}`);
    if (!art) continue;
    articles.push({
      id: art.id, type: "article", title: art.title_ar ?? "",
      lawTitle: parentLaw.title_ar ?? null,
      articleNumber: art.article_number,
      excerptHtml: wordTrunc(art.content_ar ?? "", 2000),
      verified: Boolean(art.verified), slug: null,
      lawSlug: entry.lawSlug,
      sourceUrl: parentLaw.source_url ?? null,
      force: forceFromLawStatus(parentLaw.status),
      legalStatus: art.legal_status ?? null,
      statusNote: entry.statusNoteOverride ?? art.status_note_ar ?? null,
      matchedTerms: [concept], rank: 100, inScope: true,
    });
  }

  if (!articles.length) return undefined;
  return {
    concept,
    label: DISCUSS_CONCEPT_LABEL[concept] ?? concept,
    description: DISCUSS_CONCEPT_DESC[concept],
    articles,
  };
}

/** Strips tashkeel AND folds alef variants (أ إ آ ٱ) to bare alef.
 * quick_search_v4 does the same on the DB side; mirroring it here lets
 * trigger "أخذ" match a text token "اخذ" or vice-versa without special-casing
 * every alef spelling a lawyer might use. */
function arabicNormalize(text: string): string {
  return stripTashkeel(text).replace(/[أإآٱ]/g, "ا");
}

/** Parse a DB column that may be text[], jsonb array, or comma-separated string
 * into a clean string array. Handles null/undefined safely. */
function parseKwArr(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  if (typeof v === "string") {
    try {
      const p: unknown = JSON.parse(v);
      return Array.isArray(p) ? (p as unknown[]).map(String).filter(Boolean) : (v ? [v] : []);
    } catch {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Replaces Arabic in-word punctuation (،؛؟) and ASCII period with a space
 * so they act as token delimiters. Without this, "السيارة،" is one token. */
function stripArabicPunct(text: string): string {
  return text.replace(/[،؛؟.]/g, " ");
}

function tokenize(text: string): string[] {
  return stripArabicPunct(stripTashkeel(text))
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
}

function isContentWord(w: string): boolean {
  if (w.length < 3) return false;
  if (STOPWORDS.has(w)) return false;
  if (WEAK_TERMS.has(w)) return false;
  if (COMMON_GIVEN_NAMES.has(w)) return false;
  if (/^[0-9٠-٩]+$/.test(w)) return false;
  // "ولم" = و+لم (لم ∈ STOPWORDS), "وأقر" = و+أقر (أقر ∈ WEAK_TERMS):
  // a conjunction glued onto a stopword or weak term is itself noise.
  // The `rest.length < 3` guard was removed: it wrongly blocked 3-char root
  // verbs like "باع" (ب+اع, rest="اع" len=2) that are valid content words.
  if (/^[وفبكل]/.test(w)) {
    const rest = w.slice(1);
    if (STOPWORDS.has(rest) || WEAK_TERMS.has(rest)) return false;
  }
  // "الشرطة" → rest "شرطة" ∈ WEAK_TERMS — the definite-article form leaks
  // through the checks above and is no more useful than the bare form.
  if (w.startsWith("ال") && w.length > 3) {
    const rest = w.slice(2);
    if (WEAK_TERMS.has(rest)) return false;
  }
  return true;
}

/**
 * Everyday words a lawyer writes in a statement of facts, mapped to the words
 * the statute actually uses. This closes a gap that no amount of better
 * matching can close on its own: a homicide described as «ضربه فأفضى إلى
 * وفاته» shares no word with the provisions that govern it, whose heading is
 * «القتل». Measured on the live corpus: «وفاته» returns inheritance
 * provisions of the Personal Status Act, while «قتل» returns articles 129,
 * 130, 131 and 132 of the Criminal Act — the correct ones.
 *
 * Three rules keep this honest:
 *   1. It only ADDS terms. Nothing the lawyer wrote is replaced or dropped.
 *   2. Every added term is shown in the issues list, labelled as an expansion,
 *      so the lawyer can see exactly what was searched on their behalf.
 *   3. Each entry is derived from statutory vocabulary in this corpus, not
 *      from a view about how the case should be classified.
 *
 * NEEDS A LAWYER'S REVIEW. This is a starting set, not a legal taxonomy.
 */
const CONCEPT_EXPANSIONS: { when: string[]; add: string[] }[] = [
  { when: ["وفاة", "وفاته", "وفاتها", "توفي", "توفى", "مات", "ماتت", "مقتل"], add: ["قتل"] },
  { when: ["ضرب", "ضربه", "ضربها", "اعتدى", "اعتداء", "تشاجر", "شجار", "لكم", "طعن"], add: ["أذى", "جرح"] },
  { when: ["دهس", "دهسه", "صدم", "صدمت", "اصطدم", "حادث"], add: ["مركبة", "خطأ"] },
];

/** Deterministic term extraction over the facts text: word frequency, with
 * function words, procedural vocabulary and common given names removed, then
 * concept expansions appended.
 *
 * An earlier attempt at this scored adjacent word pairs as phrases, on the
 * theory that «غسل أموال» is one concept. It was removed after testing: in a
 * short statement of facts every pair occurs exactly once, so the ranking was
 * arbitrary and it produced «تشاجر الجاني» and «أصلية عبر» while crowding out
 * the words that actually worked. Multi-word terms now come only from the
 * keywords field, where the lawyer types them deliberately.
 *
 * This is word statistics, not legal reasoning, and is labelled as such
 * everywhere it is shown. */
export function extractTerms(
  text: string,
  max = CANDIDATE_LIMIT
): { term: string; origin: "extracted" | "expanded" }[] {
  const words = tokenize(text);

  const freq = new Map<string, number>();
  for (const w of words) {
    if (!isContentWord(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
    // Arabic glues conjunctions and prepositions onto the word, and the search
    // engine does not strip them: measured on this corpus, «ونفقة» returns 2
    // articles where «نفقة» returns 40, and «وسرق» returns none where «سرق»
    // returns 15. The bare form is offered as a *further* candidate, never as
    // a replacement — a stripped form that means nothing simply finds nothing
    // and is dropped later by the same corpus evidence that keeps the rest.
    const bare = stripAttachedPrefix(w);
    // Same weight as the word it came from: ranked lower, the bare forms
    // were falling off the end of the candidate list — «حضانة» and «نفقة»
    // were cut from their own case that way.
    if (bare && !freq.has(bare) && isContentWord(bare)) freq.set(bare, freq.get(w) ?? 1);
  }

  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);

  const present = new Set(words);
  const expansions: string[] = [];
  for (const rule of CONCEPT_EXPANSIONS) {
    if (!rule.when.some((w) => present.has(w))) continue;
    for (const add of rule.add) {
      if (!present.has(add) && !expansions.includes(add)) expansions.push(add);
    }
  }

  // Expansions lead: they are the statutory vocabulary. The lawyer's own words
  // follow. Which of them survives is decided afterwards by what each one
  // actually finds in the corpus, not by this ordering — see selectIssues.
  const out: { term: string; origin: "extracted" | "expanded" }[] = [
    ...expansions.map((term) => ({ term, origin: "expanded" as const })),
    ...ranked.map((term) => ({ term, origin: "extracted" as const })),
  ];
  return out.slice(0, max);
}

/** «ونفقة» → «نفقة». Strips one leading و/ف/ب/ك/ل when what remains is still
 * a plausible word. Deliberately shallow: this is not a stemmer, and a wrong
 * strip costs nothing because the result is only ever an extra candidate. */
function stripAttachedPrefix(w: string): string | null {
  // 4, not 5: «وسرق» is four letters and its stem «سرق» is exactly the term
  // that finds the theft provisions — the longer threshold lost it.
  if (w.length < 4) return null;
  if (!/^[وفبكل]/.test(w)) return null;
  const rest = w.slice(1);
  if (rest.length < 3) return null;
  return rest;
}

/** Split on commas only. Splitting on whitespace — as this did before — meant
 * a lawyer could not enter a multi-word term at all: «غسل أموال» typed
 * deliberately was torn into two useless words before it ever reached the
 * search engine. */
function splitKeywordsField(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,،;؛\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/** Extractive, position-based excerpt — the leading sentences of what the
 * lawyer typed. No interpretation is added. */
export function buildFactsExcerpt(
  facts: string,
  maxChars = 480
): { excerpt: string; truncated: boolean } {
  const trimmed = facts.trim();
  if (trimmed.length <= maxChars) return { excerpt: trimmed, truncated: false };
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

/**
 * Criminal-domain vocabulary: everyday Arabic narrative phrases mapped to the
 * statutory terms used in the Sudanese Criminal Act 1991.
 *
 * These rules are GATED — applied only when the case type is "criminal" or
 * left empty by the user. They must never fire for a civil or personal-status
 * case even if the facts happen to include the word "أخذ" (took delivery of
 * goods under a contract is not theft).
 *
 * Matching uses proximity rather than exact substring: all words in a trigger
 * must appear within a window of EXPANSION_PROXIMITY_WINDOW consecutive text
 * tokens, in any order. Attached prefixes (و ف ب ل ك ال) are stripped from
 * text tokens before comparison, so "وأخذ" matches trigger "أخذ". Alef
 * variants (أ إ آ ٱ) are folded to bare alef on both sides via arabicNormalize.
 *
 * All statutory terms here are from the Criminal Act 1991 Arabic text:
 *  - Theft (سرقة): Arts. 171–177
 *  - Robbery (سطو): Art. 175
 *  - Breaking and entering / trespass: Art. 74 (criminal trespass), Art. 175
 *  - Assault / hurt / grievous hurt: Arts. 141–147
 *  - Fraud / احتيال: Arts. 133–134
 *  - Forgery / تزوير: Arts. 135–137
 *  - Drugs: Narcotic Drugs Act 1994 (referenced from Criminal Act provisions)
 */
type CriminalExpansionRule = {
  when: string[];
  add: string[];
};

const CRIMINAL_VOCABULARY_EXPANSIONS: CriminalExpansionRule[] = [
  // ── Theft (سرقة) ──────────────────────────────────────────────────────
  // "أخذ", "استولى" etc. are everyday verbs; "سرقة" is the statutory heading.
  {
    when: ["أخذ", "استولى", "انتزع", "سلب", "نشل", "اختلس", "سرق", "سرقة", "سطا", "يسرق"],
    add: ["سرقة"],
  },
  // ── Robbery with force or threat (سطو مسلح) ───────────────────────────
  {
    when: ["سطو", "نهب", "أرغمه", "بتهديد السلاح", "تهديد بسلاح", "بالقوة والتهديد"],
    add: ["نهب", "سرقة"],
  },
  // ── Breaking and entering / criminal trespass ──────────────────────────
  // "دخل" is in WEAK_TERMS so it will not appear as a standalone search
  // term, but CONCEPT_EXPANSIONS check `present` (the unfiltered token set),
  // so multi-word phrases and context clues here trigger the expansion.
  {
    when: [
      "اقتحم", "اقتحمه", "اقتحمها", "تسلل", "تسوّر", "تسور",
      "دخل بغير إذن", "دخل بدون إذن", "دخل المنزل بغير", "دخل البيت بغير",
      "دخل منزله قسراً", "دخل منزله بالقوة", "كسر الباب", "كسر قفل",
    ],
    add: ["تعدٍّ", "اقتحام"],
  },
  // ── Fraud / احتيال (Art. 133) ──────────────────────────────────────────
  {
    when: [
      "خدع", "غرّر", "غرر", "احتال", "أوهم", "خادع", "تغرير",
      "ادعى ملكية", "باع ما لا يملك", "باع أرضاً لا يملكها",
      "باع أرض لا يملكها", "ادعى أنه مالك", "تظاهر بأنه مالك",
    ],
    add: ["احتيال"],
  },
  // ── Forgery / تزوير (Arts. 135–137) ────────────────────────────────────
  {
    when: [
      "زوّر", "زور", "حرّف", "حرف", "زيّف", "زيف",
      "انتحل", "انتحل صفة", "تظاهر بأنه", "ادعى أنه", "انتحال صفة",
    ],
    add: ["تزوير", "انتحال"],
  },
  // ── Assault / hurt / grievous hurt (Arts. 141–147) ────────────────────
  // The existing CONCEPT_EXPANSIONS already maps "ضرب/اعتدى" → "أذى/جرح".
  // This rule adds grievous hurt (إيذاء جسيم, Art. 143) for fracture/stab.
  {
    when: [
      "كسر يده", "كسر ذراعه", "كسر رجله", "كسر أسنانه",
      "فقأ عينه", "طعنه بسكين", "طعنه بالسكين", "جرح بليغ", "إيذاء جسيم",
    ],
    add: ["إيذاء جسيم"],
  },
  // ── Homicide (قتل, Arts. 129–132) ─────────────────────────────────────
  // Physical-act verbs for death; CONCEPT_EXPANSIONS had these but they
  // were only in the extractTerms path, which bypasses the criminal map.
  {
    when: [
      "مات", "ماتت", "وفاة", "وفاته", "وفاتها", "توفي", "توفى", "توفيت", "مقتل",
    ],
    add: ["قتل"],
  },
  // ── Assault / hurt (أذى/جرح, Arts. 138–143) ────────────────────────────
  // Physical-act verbs for hurt; same reason as homicide rule above.
  {
    when: [
      "ضرب", "ضربه", "ضربها", "اعتدى", "اعتداء", "تشاجر", "شجار",
      "لكم", "طعن", "صفع", "ركل", "لطم", "عضّ", "عض",
    ],
    add: ["أذى", "جرح"],
  },
  // ── Vehicular / negligent harm (مركبة/خطأ, Arts. 132, 141) ────────────
  // Physical-act verbs for vehicle-related injury/death.
  {
    when: [
      "صدم", "صدمت", "صدمه", "دهس", "دهسه", "دهست", "اصطدم", "حادث", "حادثة",
    ],
    add: ["مركبة", "خطأ"],
  },
  // ── Criminal damage (إتلاف جنائي, Art. 182) ────────────────────────────
  {
    when: [
      "حطّم", "حطم", "حطّمه", "حطمه",
      "تحطيم", "تحطيمه",
      "أتلف", "أتلفه", "إتلاف",
      "دمّر", "دمر", "دمّره", "دمره", "تدمير",
      "خرّب", "خرب", "تخريب",
      "هشّم", "هشم", "أضرم", "أحرق",
    ],
    add: ["إتلاف جنائي"],
  },
  // ── Extortion / blackmail (ابتزاز, Art. 176) ───────────────────────────
  {
    when: [
      "هدّد", "هدد", "هدده", "هددها", "هدّده", "هدّدها",
      "ابتزّ", "ابتز", "يبتز", "تهديد",
    ],
    add: ["ابتزاز"],
  },
  // ── Unlawful confinement (حجز غير مشروع, Art. 164) ─────────────────────
  {
    when: [
      "احتجز", "يحتجز", "احتجزه", "احتجزها",
      "قيّد", "قيد", "قيّده", "قيدها",
      "أغلق عليه", "أغلق عليها", "حصره", "حبسه",
      "منع الخروج", "منع من الخروج",
    ],
    add: ["حجز غير مشروع"],
  },
  // ── Receiving stolen property (استلام مسروق, Art. 181) ─────────────────
  {
    when: ["مسروق", "مسروقة", "مسروقات"],
    add: ["استلام مسروق"],
  },
  // ── Narcotic drugs ────────────────────────────────────────────────────
  {
    when: [
      "مخدر", "مخدرات", "حشيش", "أفيون", "هيروين", "قات", "بنقو",
      "كوكايين", "مواد مخدرة", "حيازة مخدرات", "تجارة مخدرات",
      "ترويج مخدرات", "تهريب مخدرات",
    ],
    add: ["مخدرات"],
  },
];

/**
 * Compound criminal expansions: require at least one word from EACH group in
 * `allOf` to appear anywhere in the full text. Unlike `CriminalExpansionRule`,
 * there is no proximity window — the borrowing and selling events in a
 * breach-of-trust narrative are commonly in different sentences.
 *
 * Matching uses `tokenMatchesTriggerOrPrefix` so inflected forms ("باعها",
 * "تصرّف فيها") match their root triggers ("باع", "تصرّف").
 */
type CompoundCriminalExpansionRule = { allOf: string[][]; add: string[] };

const COMPOUND_CRIMINAL_EXPANSIONS: CompoundCriminalExpansionRule[] = [
  // ── Breach of trust (خيانة الأمانة, Criminal Act Arts. 161–165) ──────────
  // Pattern: property legitimately received/entrusted then unlawfully disposed of.
  // Requires ANY one entrustment signal (group 1) AND ANY one disposal signal
  // (group 2) anywhere in the text — the two events may be in different sentences.
  //
  // Group 1 covers: borrowed, rented, received, deposited, delegated, handed,
  // entrusted (أمانة/وديعة as nouns), and condition-of-return phrasing —
  // "يعيده"/"يعيدها" match "يعيدها" via the 3-char suffix tolerance so the
  // truncated-text form "على أن يعيدها" fires even when "استعار" is cut off.
  // Group 2 covers: sold, pledged, transferred, squandered, misappropriated,
  // dissipated, refused.
  {
    allOf: [
      // entrustment / legitimate receipt // REVIEW
      [
        "استعار", "استأجر",
        "تسلّم", "تسلم", "استلم",
        "أودع",
        "وكّل", "وكل",
        "سلّمه", "سلمه",
        "عهد",
        "أمانة", "وديعة",
        "يعيده", "يعيدها", "يرده", "يردها",
      ],
      // unlawful disposal // REVIEW
      [
        "باع", "تصرّف", "تصرف", "رهن", "نقل",
        "فرّط", "فرط", "أتلف", "اختلس",
        "بدّد", "بدد", "امتنع",
        "حوّل", "حول",
      ],
    ],
    add: ["خيانة الأمانة"],
  },
  // ── Custodian / fiduciary misappropriation (also خيانة الأمانة) ───────────
  {
    allOf: [
      ["أمين", "وديعة", "مستأمن", "وكيل", "أمانة"],
      ["اختلس", "استغل", "حوّل", "حول", "أنفق"],
    ],
    add: ["خيانة الأمانة"],
  },
];

/** Tokens within this many positions of each other are considered "near". */
const EXPANSION_PROXIMITY_WINDOW = 6;

/** Words that identify a dwelling in the facts text — used by the special
 * "دخل + dwelling" trespass trigger. */
const DWELLING_WORDS = [
  "منزل", "بيت", "دار", "شقة", "محل", "مبنى", "مسكن", "غرفة",
  "عمارة", "مخزن", "مستودع", "عقار",
];

/** All bare forms of a text token, after arabicNormalize: the token itself;
 * with the definite article (ال) stripped; with a one-char conjunction /
 * preposition (و ف ب ل ك) stripped; and with both stripped in sequence.
 * "وأخذ" → {"وأخذ", "واخذ" (already normalized), "اخذ"} which matches
 * trigger "أخذ" whose normalized form is "اخذ". */
function getBareFormsNormalized(rawToken: string): Set<string> {
  const n = arabicNormalize(rawToken);
  const s = new Set<string>([n]);
  let t = n;
  if (t.startsWith("ال") && t.length > 3) { t = t.slice(2); s.add(t); }
  if (/^[وفبلك]/.test(t) && t.length > 2) {
    const stripped1 = t.slice(1);
    s.add(stripped1);
    if (stripped1.startsWith("ال") && stripped1.length > 3) s.add(stripped1.slice(2));
  }
  return s;
}

/** True when any bare form of `textToken` equals the arabicNormalized form
 * of `triggerWord`. Handles prefix attachments on both sides. */
function tokenMatchesTrigger(textToken: string, triggerWord: string): boolean {
  return getBareFormsNormalized(textToken).has(arabicNormalize(triggerWord));
}

/** Like `tokenMatchesTrigger` but also accepts a text token that *starts with*
 * the trigger (up to 3 trailing characters of tolerance for Arabic pronominal
 * suffixes: ه، ها، هم، هن، ك، كم، نا). Used only in compound rules where the
 * verb "باع" may appear as "باعها" (sold it) — getBareFormsNormalized strips
 * prefixes but not suffix pronouns, so exact matching would miss inflected forms. */
function tokenMatchesTriggerOrPrefix(textToken: string, triggerWord: string): boolean {
  const normTrigger = arabicNormalize(triggerWord);
  if (normTrigger.length < 3) return false;
  for (const bare of getBareFormsNormalized(textToken)) {
    if (bare === normTrigger) return true;
    // forward: text token is a suffixed form of the trigger ("باعها" matches "باع")
    if (bare.startsWith(normTrigger) && bare.length <= normTrigger.length + 3) return true;
    // reverse: trigger is a suffixed form and text has the bare root ("سلم" matches "سلمه")
    if (bare.length >= 3 && normTrigger.startsWith(bare) && normTrigger.length <= bare.length + 3) return true;
  }
  return false;
}

/** True when every word in `triggerWords` appears at least once inside at
 * least one consecutive window of `windowSize` text tokens, in any order.
 * Order-independence handles natural Arabic word order variation; the window
 * cap prevents a common word in one clause from pairing with an unrelated word
 * fifty tokens away. */
function windowContainsAll(
  tokens: string[],
  triggerWords: string[],
  windowSize: number
): boolean {
  if (triggerWords.length === 0) return false;
  for (let i = 0; i < tokens.length; i++) {
    const win = tokens.slice(i, i + windowSize);
    if (triggerWords.every((tw) => win.some((t) => tokenMatchesTriggerOrPrefix(t, tw)))) return true;
  }
  return false;
}

/**
 * Apply criminal vocabulary expansions to the facts text. Returns the new
 * statutory terms to add to the candidate pool and a flag indicating whether
 * any rule fired (used to infer the case type when none was supplied).
 *
 * Three improvements over the original substring/set approach:
 *   1. arabicNormalize folds alef variants on both text and triggers, so
 *      "أخذ" and "اخذ" both match.
 *   2. Proximity matching: all words of a multi-word trigger must appear within
 *      EXPANSION_PROXIMITY_WINDOW consecutive tokens (any order), so gaps
 *      between words ("دخل شخص منزله") no longer cause a miss.
 *   3. getBareFormsNormalized strips attached prefixes (وأخذ → أخذ) from text
 *      tokens before comparing to triggers, so conjunction-prefixed verbs match.
 */
function applyCriminalExpansions(
  text: string
): { terms: { term: string; origin: "expanded" }[]; anyFired: boolean } {
  // Work from arabicNormalize'd tokens. Splitting after normalize (rather than
  // calling tokenize which uses stripTashkeel only) ensures alef variants are
  // folded before getBareFormsNormalized compares them to triggers.
  const tokens = arabicNormalize(stripArabicPunct(text))
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
  const out: { term: string; origin: "expanded" }[] = [];
  const added = new Set<string>();
  let anyFired = false;

  for (const rule of CRIMINAL_VOCABULARY_EXPANSIONS) {
    // Each trigger is split into words (handles both single-word and
    // multi-word triggers uniformly via proximity matching).
    const fires = rule.when.some((w) =>
      windowContainsAll(tokens, w.split(/\s+/), EXPANSION_PROXIMITY_WINDOW)
    );
    if (!fires) continue;
    anyFired = true;
    for (const t of rule.add) {
      if (!added.has(t)) { added.add(t); out.push({ term: t, origin: "expanded" }); }
    }
  }

  // Special trespass trigger: "دخل" (entered) alone is too broad to be useful,
  // but "دخل" within EXPANSION_PROXIMITY_WINDOW tokens of a dwelling word
  // reliably identifies a break-in narrative even when the lawyer does not
  // use the statutory "اقتحم" or "تسلل".
  const trespassAlreadyFired = added.has("تعدٍّ") || added.has("اقتحام");
  if (!trespassAlreadyFired) {
    const firesViaDwelling = DWELLING_WORDS.some((dw) =>
      windowContainsAll(tokens, ["دخل", dw], EXPANSION_PROXIMITY_WINDOW)
    );
    if (firesViaDwelling) {
      anyFired = true;
      for (const t of ["تعدٍّ", "اقتحام"]) {
        if (!added.has(t)) { added.add(t); out.push({ term: t, origin: "expanded" }); }
      }
    }
  }

  // Compound rules: all groups must fire somewhere in the text (no proximity
  // window — the two events may be in different sentences).
  for (const rule of COMPOUND_CRIMINAL_EXPANSIONS) {
    const fires = rule.allOf.every((group) =>
      group.some((trigger) =>
        tokens.some((t) => tokenMatchesTriggerOrPrefix(t, trigger))
      )
    );
    if (!fires) continue;
    anyFired = true;
    for (const t of rule.add) {
      if (!added.has(t)) { added.add(t); out.push({ term: t, origin: "expanded" }); }
    }
  }

  return { terms: out, anyFired };
}

/**
 * Pure (no DB): resolve the case type free text to one of the known category
 * slugs from CASE_TYPE_TO_CATEGORY. Returns null when no match is found or
 * the input is blank.
 */
function getCaseTypeSlug(caseType: string | undefined): string | null {
  const raw = (caseType ?? "").trim();
  if (!raw) return null;
  const needle = stripTashkeel(raw);
  const hit = CASE_TYPE_TO_CATEGORY.find((c) => c.match.some((m) => needle.includes(m)));
  return hit?.slug ?? null;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/** True when the article's title or excerpt places "جريمة" within 5 tokens of
 * one of the expanded statutory terms. This identifies the definitional
 * articles ("يُعدّ مرتكباً لجريمة السرقة كل من...") that should rank first. */
function isOffenceDefiningFor(
  entry: RetrievedAuthority,
  expandedTerms: ReadonlySet<string>
): boolean {
  if (entry.type !== "article" || expandedTerms.size === 0) return false;
  const titleTokens = arabicNormalize(stripArabicPunct(entry.title ?? ""))
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
  const excerptTokens = arabicNormalize(stripArabicPunct(stripHtmlTags(entry.excerptHtml)))
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
  for (const term of expandedTerms) {
    const termN = arabicNormalize(term);
    const termWords = termN.split(/\s+/).filter(Boolean);
    if (termWords.length === 1) {
      if (
        // "جريمة [term]" as article heading
        windowContainsAll(titleTokens, ["جريمة", termN], 5) ||
        // article title IS the offence name (e.g. "السرقة")
        titleTokens.some((t) => tokenMatchesTrigger(t, term)) ||
        // definitional sentence in excerpt: "يعد مرتكباً لجريمة [term]"
        windowContainsAll(excerptTokens, ["جريمة", termN], 5)
      ) return true;
    } else {
      // Multi-word expanded term (e.g. "خيانة الأمانة"): all words must
      // appear together in the title, or near "جريمة" in the excerpt.
      if (windowContainsAll(titleTokens, termWords, termWords.length + 2)) return true;
      if (windowContainsAll(excerptTokens, ["جريمة", ...termWords], termWords.length + 4)) return true;
    }
  }
  return false;
}

/** True when the article number (parsed as an integer) is 1–5. Articles 1–5
 * of most Sudanese statutes are interpretation/definitions sections. */
function isDefinitionsArticle(entry: RetrievedAuthority): boolean {
  if (entry.type !== "article") return false;
  const raw = (entry.articleNumber ?? "")
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = raw.match(/^(\d+)/);
  if (!m) return false;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 5;
}

/** True when the case's excerpt or legal principle explicitly mentions one of
 * the expanded statutory terms — a stronger signal than sharing a category. */
function caseMatchesExpandedTerms(
  c: RetrievedCase,
  expandedTerms: ReadonlySet<string>
): boolean {
  if (expandedTerms.size === 0) return false;
  const rawText = stripHtmlTags(c.excerptHtml) + " " + (c.principle ?? "");
  const tokens = arabicNormalize(stripArabicPunct(rawText)).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (const term of expandedTerms) {
    const termWords = arabicNormalize(term).split(/\s+/).filter(Boolean);
    if (termWords.length === 1) {
      if (tokens.some((t) => tokenMatchesTrigger(t, term))) return true;
    } else {
      if (termWords.every((w) => tokens.some((t) => tokenMatchesTrigger(t, w)))) return true;
    }
  }
  return false;
}

/** `status_rank` as quick_search_v4 emits it: 0 in force, 1 disputed,
 * 2 repealed. `law_status = 'reference'` is the corpus's "under review". */
function forceOf(row: { status_rank: number | null; law_status: string | null }): ForceStatus {
  if (row.law_status === "reference") return "under_review";
  if (row.status_rank === null || row.status_rank === undefined) return "unknown";
  if (row.status_rank === 0) return "in_force";
  return "not_in_force";
}

/** Map a `laws.status` column value to a `ForceStatus` for concept-map articles. */
function forceFromLawStatus(status?: string | null): ForceStatus {
  switch (status) {
    case "active":
    case "published": return "in_force";
    case "repealed":  return "not_in_force";
    case "reference": return "under_review";
    default:          return "unknown";
  }
}

/** Truncate at the last word boundary before `limit` chars; append "…" if cut. */
function wordTrunc(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(" ", limit);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, limit)) + "…";
}

type V4Row = {
  result_type: string;
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  snippet: string | null;
  identifier: string | null;
  slug: string | null;
  law_id: string | null;
  law_slug: string | null;
  year_val: number | null;
  rank: number | null;
  legal_status: string | null;
  status_note_ar: string | null;
  law_status: string | null;
  status_rank: number | null;
};

type V3Row = {
  result_type: string;
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  snippet: string | null;
  identifier: string | null;
  slug: string | null;
  parent_law_id: string | null;
  rank: number | null;
  headline: string | null;
  law_status: string | null;
  status_rank: number | null;
  status_note_ar: string | null;
};

type ResolvedCaseType = {
  slug: string;
  categoryId: string | null;
  categoryNameAr: string | null;
  /** IDs of companion laws (Criminal Procedure, Evidence, etc.) fetched by slug. */
  companionLawIds: string[];
  /** True when the user left caseType empty and criminal expansion rules fired. */
  inferred: boolean;
};

/**
 * Resolve the case type to a primary category + companion law IDs.
 *
 * When `inferCriminal` is true (user left caseType empty but criminal
 * expansions fired), we treat the case as criminal and look up the category
 * and companion laws accordingly. The `inferred` field on the return value
 * lets the UI display a note about the inference.
 */
async function resolveCaseTypeFull(
  supabase: SupabaseClient,
  caseType: string | undefined,
  inferCriminal: boolean
): Promise<ResolvedCaseType | null> {
  const slug = getCaseTypeSlug(caseType);
  const effectiveSlug = slug ?? (inferCriminal ? "criminal" : null);
  if (!effectiveSlug) return null;

  const [catResult, companionResult] = await Promise.all([
    supabase.from("categories").select("id, name_ar").eq("slug", effectiveSlug).maybeSingle(),
    (() => {
      const companions = CASE_TYPE_COMPANIONS[effectiveSlug] ?? [];
      if (companions.length === 0) return Promise.resolve({ data: [] as { id: string }[] });
      return supabase.from("laws").select("id").in("slug", companions);
    })(),
  ]);

  return {
    slug: effectiveSlug,
    categoryId: catResult.data ? (catResult.data.id as string) : null,
    categoryNameAr: catResult.data ? ((catResult.data.name_ar as string) ?? effectiveSlug) : null,
    companionLawIds: (companionResult.data ?? []).map((l) => l.id),
    inferred: !slug && inferCriminal,
  };
}

// ── Criminal concept-map path ─────────────────────────────────────────────
// Used whenever the resolved case type is "criminal". Replaces the text-search
// law pipeline with a deterministic map lookup: each fired concept term
// resolves to pre-reviewed (lawSlug, articleNumber) pairs. No text search is
// ever sent for laws in this path. Cases still use quick_search_v4, but only
// results inside the primary criminal category are kept.
async function analyzeCriminalConceptMap(
  supabase: SupabaseClient,
  input: CaseMapperInput,
  caseTypeFull: ResolvedCaseType,
  criminalTerms: { term: string; origin: "expanded" }[],
  excerpt: string,
  truncated: boolean,
  discussConcepts?: string[],
): Promise<CaseMapResult> {
  const addTerm = (arr: string[], term: string) => {
    if (!arr.includes(term)) arr.push(term);
  };

  // The LLM is authoritative: use its concept(s) only, not extractTerms expansions.
  // Expansions (CONCEPT_EXPANSIONS) add noise here — they fire on assault verbs and
  // inject "جرح"/"أذى" regardless of what the LLM classified (نهب, قتل عمد, etc.).
  const allConceptTerms = dropBareJurhIfWound(dropAthaIfWound(
    criminalTerms.map((t) => t.term)
  ));

  // Internal keys (e.g. "قتل:وصف") must never reach the search engine — they
  // contain a colon and would match nothing.  Map each to the clean query term
  // that actually retrieves relevant cases and principles.
  const SEARCH_QUERY_FOR_TERM: Record<string, string> = {
    "قتل:وصف": "قتل",
    "جرح:وصف": "جرح",
  };
  function searchQuery(term: string): string {
    return SEARCH_QUERY_FOR_TERM[term] ?? term;
  }

  const showLens = Boolean(input.caseType?.trim() || caseTypeFull.inferred);
  const caseTypeLens = showLens
    ? {
        input: input.caseType?.trim() ||
          (caseTypeFull.inferred ? `${caseTypeFull.categoryNameAr ?? "جنائي"} (مستنتج)` : ""),
        categoryNameAr: caseTypeFull.categoryNameAr ?? null,
        inferred: caseTypeFull.inferred,
      }
    : null;
  const inferredCaseType = caseTypeFull.inferred ? (caseTypeFull.categoryNameAr ?? "جنائي") : null;

  // No concept fired → immediate noConfidentMatch, skip all DB queries.
  // Exception: discuss-only path (e.g. مخدرات:معمل from lab-pending early exit) — fall
  // through so the discuss-item fetch can run.
  if (allConceptTerms.length === 0 && !(discussConcepts?.length)) {
    return {
      factsExcerpt: excerpt, factsIsTruncated: truncated,
      caseTypeLens, inferredCaseType,
      issues: [], laws: [], cases: [], principles: [],
      outOfScopeCount: 0, noConfidentMatch: true, hasAnyResults: false,
    };
  }

  // Map concepts to (lawSlug, articleNumber) pairs — deduped, map-order preserved
  const mappedEntries: Array<ConceptArticleEntry & { conceptTerm: string }> = [];
  const seenPairs = new Set<string>();
  for (const term of allConceptTerms) {
    for (const entry of CONCEPT_TO_ARTICLES[term] ?? []) {
      const key = `${entry.lawSlug}:${entry.articleNumber}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        mappedEntries.push({ ...entry, conceptTerm: term });
      }
    }
  }

  // Concept fired but no map entry yet → noConfidentMatch.
  // Exception: when discuss concepts are present (discuss-only path, e.g. إتلاف:بيّنة),
  // fall through so the discuss-item fetch can run and return the card.
  if (mappedEntries.length === 0 && !(discussConcepts?.length)) {
    return {
      factsExcerpt: excerpt, factsIsTruncated: truncated,
      caseTypeLens, inferredCaseType,
      issues: [], laws: [], cases: [], principles: [],
      outOfScopeCount: 0, noConfidentMatch: true, hasAnyResults: false,
    };
  }

  // Query 1: resolve law slugs → law rows
  const uniqueSlugs = [...new Set(mappedEntries.map((e) => e.lawSlug))];
  const { data: lawsData } = await supabase
    .from("laws")
    .select("id, slug, title_ar, source_url, verified, status")
    .in("slug", uniqueSlugs);

  type LawRow = { id: string; slug: string; title_ar: string | null; source_url: string | null; verified: boolean | null; status?: string | null };
  const lawBySlug = new Map<string, LawRow>(
    ((lawsData ?? []) as LawRow[]).map((l) => [l.slug, l])
  );
  const lawIds = [
    ...new Set(uniqueSlugs.map((s) => lawBySlug.get(s)?.id).filter(Boolean) as string[]),
  ];

  // Query 2: fetch articles by (law_id, article_number)
  type ArticleRow = {
    id: string; law_id: string; article_number: string | null;
    title_ar: string | null; content_ar: string | null;
    verified: boolean | null; status_note_ar: string | null;
    legal_status: string | null;
  };
  const articlesData = await fetchAllArticlesForLaws<ArticleRow>(supabase, lawIds);

  const articleByPair = new Map<string, ArticleRow>(
    ((articlesData ?? []) as ArticleRow[]).map((a) => [
      `${a.law_id}:${(a.article_number ?? "").trim()}`,
      a,
    ])
  );


  // Build authority map in concept-map order
  const authorityMap = new Map<string, RetrievedAuthority>();
  for (const entry of mappedEntries) {
    const parentLaw = lawBySlug.get(entry.lawSlug);
    if (!parentLaw) continue;
    const artKey = `${parentLaw.id}:${entry.articleNumber}`;
    const article = articleByPair.get(artKey);
    if (!article) continue;

    const existing = authorityMap.get(article.id);
    if (existing) {
      addTerm(existing.matchedTerms, entry.conceptTerm);
      if (entry.statusNoteOverride != null) {
        const dbNote = article.status_note_ar ?? null;
        existing.statusNote = dbNote
          ? `${entry.statusNoteOverride} — ${dbNote}`
          : entry.statusNoteOverride;
      }
    } else {
      const _dbNote = article.status_note_ar ?? null;
      authorityMap.set(article.id, {
        id: article.id,
        type: "article",
        title: article.title_ar ?? "",
        lawTitle: parentLaw.title_ar ?? null,
        articleNumber: article.article_number,
        excerptHtml: wordTrunc(article.content_ar ?? "", 600),
        verified: Boolean(article.verified),
        slug: null,
        lawSlug: entry.lawSlug,
        sourceUrl: parentLaw.source_url ?? null,
        force: forceFromLawStatus(parentLaw.status),
        legalStatus: article.legal_status ?? null,
        statusNote: entry.statusNoteOverride != null
          ? (_dbNote ? `${entry.statusNoteOverride} — ${_dbNote}` : entry.statusNoteOverride)
          : _dbNote,
        matchedTerms: [entry.conceptTerm],
        rank: 100,
        inScope: true,
      });
    }
  }

  const mappedLawList = [...authorityMap.values()];

  // Discuss articles — separate from ranked results, never in `laws`.
  // The main DB query already fetched all articles for the laws in lawIds,
  // so criminal-law-1991 articles (19/20/130) are already in articleByPair.
  // For any discuss law not yet in lawBySlug we do a supplementary fetch.
  let discussItems: DiscussItem[] | undefined;
  if (discussConcepts?.length) {
    const discussEntries: Array<ConceptArticleEntry & { concept: string }> = [];
    for (const concept of discussConcepts) {
      for (const entry of DISCUSS_CONCEPT_TO_ARTICLES[concept] ?? []) {
        discussEntries.push({ ...entry, concept });
      }
    }
    if (discussEntries.length) {
      // Supplement lawBySlug / articleByPair if discuss laws are not yet loaded.
      const extraSlugs = [
        ...new Set(discussEntries.map((e) => e.lawSlug).filter((s) => !lawBySlug.has(s))),
      ];
      if (extraSlugs.length) {
        const { data: extraLaws } = await supabase
          .from("laws")
          .select("id, slug, title_ar, source_url, verified, status")
          .in("slug", extraSlugs);
        const extraLawRows = (extraLaws ?? []) as Array<{
          id: string; slug: string; title_ar: string | null;
          source_url: string | null; verified: boolean | null; status?: string | null;
        }>;
        const extraLawIds = extraLawRows.map((l) => l.id);
        extraLawRows.forEach((l) => lawBySlug.set(l.slug, l));
        if (extraLawIds.length) {
          const extraArts = await fetchAllArticlesForLaws<{
            id: string; law_id: string; article_number: string | null;
            title_ar: string | null; content_ar: string | null;
            verified: boolean | null; status_note_ar: string | null;
            legal_status: string | null;
          }>(supabase, extraLawIds);
          for (const a of extraArts as Array<{
            id: string; law_id: string; article_number: string | null;
            title_ar: string | null; content_ar: string | null;
            verified: boolean | null; status_note_ar: string | null;
            legal_status: string | null;
          }>) {
            articleByPair.set(`${a.law_id}:${(a.article_number ?? "").trim()}`, a);
          }
        }
      }

      const byConceptMap = new Map<string, RetrievedAuthority[]>();
      for (const entry of discussEntries) {
        const parentLaw = lawBySlug.get(entry.lawSlug);
        if (!parentLaw) continue;
        const artKey = `${parentLaw.id}:${entry.articleNumber}`;
        const article = articleByPair.get(artKey);
        if (!article) continue;
        const art: RetrievedAuthority = {
          id: article.id,
          type: "article",
          title: article.title_ar ?? "",
          lawTitle: parentLaw.title_ar ?? null,
          articleNumber: article.article_number,
          excerptHtml: wordTrunc(article.content_ar ?? "", 2000), // discuss: full text for lawyer reference
          verified: Boolean(article.verified),
          slug: null,
          lawSlug: entry.lawSlug,
          sourceUrl: parentLaw.source_url ?? null,
          force: forceFromLawStatus(parentLaw.status),
          legalStatus: article.legal_status ?? null,
          statusNote: entry.statusNoteOverride ?? article.status_note_ar ?? null,
          matchedTerms: [entry.concept],
          rank: 100,
          inScope: true,
        };
        const arr = byConceptMap.get(entry.concept) ?? [];
        arr.push(art);
        byConceptMap.set(entry.concept, arr);
      }
      const NEGATE_KILL_NOTE =
        "ورد في الوقائع نفيٌ لقصد القتل. وهو قرينة تُفحص مع سائر الظروف، ولا تحسم الوصف وحدها.";
      const negateKill = factsNegateIntentToKill(input.facts);
      discussItems = [...byConceptMap.entries()].map(([concept, articles]) => {
        const desc = DISCUSS_CONCEPT_DESC[concept];
        const evLine = DISCUSS_CONCEPT_EVIDENCE[concept];
        const cautLine = DISCUSS_CONCEPT_CAUTION[concept];
        const negNote =
          concept === "قتل:وصف" && negateKill ? NEGATE_KILL_NOTE : undefined;
        return {
          concept,
          label: DISCUSS_CONCEPT_LABEL[concept] ?? concept,
          ...(desc    ? { description: desc }      : {}),
          ...(evLine  ? { evidenceLine: evLine }    : {}),
          ...(cautLine ? { cautionLine: cautLine }  : {}),
          ...(negNote ? { negationNote: negNote }   : {}),
          articles,
        };
      });
    }

    // Commit 52: CARD_ONLY concepts produce a DiscussItem with articles: [] without a DB fetch.
    const cardOnlyItems: DiscussItem[] = [];
    for (const concept of discussConcepts) {
      if (!CARD_ONLY_CONCEPTS.has(concept)) continue;
      if (concept === "قرار:مشروعية") {
        const adminResult = factsMatchAdminAppointmentReview(input.facts);
        if (adminResult === null) continue;
        const conflLine = adminResult === "conflict"
          ? DISCUSS_CONCEPT_CONFLICT_LINE[concept]
          : undefined;
        cardOnlyItems.push({
          concept,
          label: DISCUSS_CONCEPT_LABEL[concept] ?? concept,
          ...(DISCUSS_CONCEPT_DESC[concept]     ? { description:  DISCUSS_CONCEPT_DESC[concept]     } : {}),
          ...(DISCUSS_CONCEPT_EVIDENCE[concept] ? { evidenceLine: DISCUSS_CONCEPT_EVIDENCE[concept] } : {}),
          ...(DISCUSS_CONCEPT_CAUTION[concept]  ? { cautionLine:  DISCUSS_CONCEPT_CAUTION[concept]  } : {}),
          ...(conflLine                         ? { conflictLine: conflLine                          } : {}),
          articles: [],
        });
      }
    }
    if (cardOnlyItems.length) {
      discussItems = [...(discussItems ?? []), ...cardOnlyItems];
    }
  }

  // Case search: concept terms only, filter to primary criminal category
  const caseCandidates = await Promise.all(
    allConceptTerms.map(async (term) => {
      const { data, error } = await supabase.rpc("quick_search_v4", {
        q: searchQuery(term), limit_rows: PER_TERM_LIMIT, include_repealed: true,
      });
      return { term, rows: (error ? [] : (data ?? [])) as V4Row[] };
    })
  );

  const caseMap = new Map<string, RetrievedCase>();
  for (const { term, rows } of caseCandidates) {
    for (const row of rows) {
      if (row.result_type !== "case") continue;
      const existing = caseMap.get(row.entity_id);
      if (existing) {
        addTerm(existing.matchedTerms, term);
        existing.rank = Math.max(existing.rank, row.rank ?? 0);
      } else {
        caseMap.set(row.entity_id, {
          id: row.entity_id,
          title: row.title ?? "",
          courtName: null,
          year: row.year_val ?? null,
          judgmentDate: null,
          citation: row.subtitle ?? null,
          caseNumber: row.identifier ?? null,
          principle: null,
          excerptHtml: row.snippet ?? "",
          authority: "unverified",
          slug: row.slug,
          sourceUrl: null,
          matchedTerms: [term],
          inScope: false,
          rank: row.rank ?? 0,
          keywords: [],
          tags: [],
        });
      }
    }
  }

  // Enrich case details: court name, authority level, category (for in-scope)
  const caseIds = [...caseMap.keys()];
  type CaseDetailRow = {
    id: string; verified: boolean | null; authority_status: string | null;
    court_id: string | null; year: number | null; judgment_date: string | null;
    case_number: string | null; citation_ar: string | null;
    principle_ar: string | null; source_url: string | null; category_id: string | null;
    keywords: unknown; tags: unknown; metadata: unknown;
  };
  const { data: casesDetail } = caseIds.length
    ? await supabase
        .from("cases")
        .select("id, verified, authority_status, court_id, year, judgment_date, case_number, citation_ar, principle_ar, source_url, category_id, keywords, tags, metadata")
        .in("id", caseIds)
    : { data: [] as CaseDetailRow[] };

  const courtIds = [
    ...new Set(((casesDetail ?? []) as CaseDetailRow[]).map((c) => c.court_id).filter(Boolean)),
  ] as string[];
  const { data: courts } = courtIds.length
    ? await supabase.from("courts").select("id, name_ar").in("id", courtIds)
    : { data: [] as { id: string; name_ar: string | null }[] };
  const courtNameById = new Map(
    ((courts ?? []) as { id: string; name_ar: string | null }[]).map((c) => [c.id, c.name_ar])
  );
  const caseDetailById = new Map(
    ((casesDetail ?? []) as CaseDetailRow[]).map((c) => [c.id, c])
  );

  for (const c of caseMap.values()) {
    const d = caseDetailById.get(c.id);
    if (!d) continue;
    c.courtName = d.court_id ? courtNameById.get(d.court_id) ?? null : null;
    c.year = d.year ?? c.year;
    c.judgmentDate = d.judgment_date ?? null;
    c.citation = d.citation_ar ?? c.citation;
    c.caseNumber = d.case_number ?? c.caseNumber;
    c.principle = d.principle_ar ?? null;
    c.sourceUrl = d.source_url ?? null;
    c.authority = caseAuthority(d);
    c.inScope = Boolean(caseTypeFull.categoryId && d.category_id === caseTypeFull.categoryId);
    c.keywords = parseKwArr(d.keywords);
    c.tags = parseKwArr(d.tags);
  }

  // Classify each in-scope case by precedent relevance; keep only direct/conditional.
  const activeConcepts = [...allConceptTerms, ...(discussConcepts ?? [])];
  const authorityOrder: Record<AuthorityLevel, number> = {
    verified: 0, unverified: 1, needs_review: 2, overruled: 3,
  };
  const precedentStats = { direct: 0, conditional: 0, hidden: 0, unindexed: 0 };
  const classifiedCases: RetrievedCase[] = [];
  for (const c of caseMap.values()) {
    if (!c.inScope) continue;
    const cMeta = caseDetailById.get(c.id);
    const rel = classifyPrecedent(
      [...c.keywords, ...c.tags], activeConcepts, conceptMapJson,
      cMeta?.metadata as { engine_eligible?: boolean } | null
    );
    c.relevance = rel;
    precedentStats[rel.outcome]++;
    if (rel.outcome === "direct" || rel.outcome === "conditional") {
      classifiedCases.push(c);
    }
  }
  const caseList = classifiedCases.sort((a, b) => {
    const aD = a.relevance!.outcome === "direct";
    const bD = b.relevance!.outcome === "direct";
    if (aD !== bD) return aD ? -1 : 1;
    if (authorityOrder[a.authority] !== authorityOrder[b.authority]) {
      return authorityOrder[a.authority] - authorityOrder[b.authority];
    }
    return b.rank - a.rank;
  });

  // Principles: concept terms only, no laws (replaced by map above)
  const v3Results = await Promise.all(
    allConceptTerms.map(async (term) => {
      const { data, error } = await supabase.rpc("universal_search_v3", {
        q: searchQuery(term),
        result_types: ["principle"],
        filter_category_id: caseTypeFull.categoryId ?? null,
        limit_per_type: V3_PER_TYPE,
        overall_limit: V3_OVERALL,
      });
      return { term, rows: (error ? [] : (data ?? [])) as V3Row[] };
    })
  );

  const principleMap = new Map<string, RetrievedPrinciple>();
  for (const { term, rows } of v3Results) {
    for (const row of rows) {
      if (row.result_type !== "principle") continue;
      const existing = principleMap.get(row.entity_id);
      if (existing) { addTerm(existing.matchedTerms, term); }
      else {
        principleMap.set(row.entity_id, {
          id: row.entity_id,
          title: row.title ?? "",
          category: row.subtitle ?? null,
          summary: row.snippet ?? null,
          slug: row.slug,
          matchedTerms: [term],
          rank: row.rank ?? 0,
        });
      }
    }
  }
  const principleList = [...principleMap.values()].sort((a, b) => b.rank - a.rank);

  // Issues: one per concept term that produced at least a law or case result
  const issues: IssueLens[] = allConceptTerms
    .filter(
      (term) =>
        mappedLawList.some((l) => l.matchedTerms.includes(term)) ||
        caseList.some((c) => c.matchedTerms.includes(term)) ||
        principleList.some((p) => p.matchedTerms.includes(term))
    )
    .map((term) => ({
      term,
      origin: "expanded" as const,
      topLaw: mappedLawList.find((l) => l.matchedTerms.includes(term)) ?? null,
      topCase: caseList.find((c) => c.matchedTerms.includes(term)) ?? null,
      topPrinciple: principleList.find((p) => p.matchedTerms.includes(term)) ?? null,
      searchedAndEmpty: false,
    }));

  return {
    factsExcerpt: excerpt, factsIsTruncated: truncated,
    caseTypeLens, inferredCaseType, issues,
    laws: mappedLawList.slice(0, DISPLAY_CAP),
    cases: caseList.slice(0, DISPLAY_CAP),
    principles: principleList.slice(0, DISPLAY_CAP),
    outOfScopeCount: 0,
    noConfidentMatch: false,
    hasAnyResults: mappedLawList.length > 0 || caseList.length > 0 || principleList.length > 0
      || (discussItems?.length ?? 0) > 0,
    ...(discussItems?.length ? { discuss: discussItems } : {}),
    precedentStats,
  };
}

// Keyword gate lists and matcher functions live in ./kw-matcher.mjs (imported above).

export async function analyzeCase(
  supabase: SupabaseClient,
  input: CaseMapperInput
): Promise<CaseMapResult> {
  const { excerpt, truncated } = buildFactsExcerpt(input.facts);

  // ── Phase 0.5: criminal expansion probe ───────────────────────────────
  // Runs BEFORE case-type resolution so that fired concepts override any
  // non-criminal label the user supplied (money words, "مالية", "مدني", etc.
  // are secondary to a live criminal concept like خيانة الأمانة). When
  // anyFired, we pass undefined caseType to resolveCaseTypeFull so it
  // derives "criminal" from inferCriminal rather than the user-supplied text.
  let { terms: criminalTerms, anyFired } = applyCriminalExpansions(input.facts);
  let officialImpersonatorGateFired = false;

  // ── LLM post-deterministic veto ────────────────────────────────────────
  // Runs even when word lists fired (anyFired=true) so it can correct a wrong
  // concept or abstain when a required offence element is missing from the facts.
  // Required for B2-018 (correction) and B2-020 (abstention despite theft trigger).
  // Article numbers never come from the LLM — only CONCEPT_TO_ARTICLES is used.
  let qadhfDowngraded = false;
  let llmResult = await classifyWithLLM(
    input.facts,
    process.env.ANTHROPIC_API_KEY ?? "",
  );
  // Commit 48/49: computed once here so blocks (B), (C), and (A) all share the results.
  const chq    = factsMatchChequeDishonour(input.facts);
  const alt    = factsMatchDocumentAlteration(input.facts);
  const off124 = factsMatchPublicOfficialFalseEntry(input.facts);
  if (llmResult.type === "abstain") {
    // Commit 36/38: deterministic fallback when the LLM abstains but keyword detectors
    // identify a recognisable pattern — never asserts intent or guilt.
    const assaultDeath =
      factsMatchDeliberateAssault(input.facts) && factsMatchDeath(input.facts);
    const propDmg     = factsMatchPropertyDamage(input.facts);
    const propRescue  = propDmg && factsMatchRescueNecessity(input.facts);
    const propAccident = propDmg && factsMatchAccidentMarker(input.facts);
    const fire        = factsMatchFireDamage(input.facts);
    const entrust     = factsMatchEntrustment(input.facts);
    if (!assaultDeath && !propRescue && !propAccident && !fire && !entrust && chq === null && !alt) {
      return {
        factsExcerpt: excerpt, factsIsTruncated: truncated,
        caseTypeLens: null, inferredCaseType: null,
        issues: [], laws: [], cases: [], principles: [],
        outOfScopeCount: 0, noConfidentMatch: true, hasAnyResults: false,
      };
    }
    if (assaultDeath) {
      // (a) Assault + death: route through homicide open-point gate (Art. 129 + قتل:وصف card).
      llmResult = { type: "criminal" as const, concept: "قتل:وصف", discuss: [] };
    } else if (propRescue) {
      // (b) Necessity: property damage in a rescue context → Art. 15 open-point card.
      llmResult = {
        type: "criminal" as const,
        concept: "إباحة:ضرورة",
        discuss: ["إباحة:ضرورة"],
      };
    } else if (propAccident) {
      // (c) Accident: property damage without intent → Art. 16 open-point card.
      llmResult = {
        type: "criminal" as const,
        concept: "إباحة:عرضي",
        discuss: ["إباحة:عرضي"],
      };
    } else if (entrust) {
      // (e) Entrustment: Art. 177 research-only + open-point card.
      llmResult = {
        type: "criminal" as const,
        concept: "أمانة:مدني",
        discuss: ["أمانة:مدني"],
      };
    } else if (chq !== null) {
      // (f) Cheque dishonour: Art. 179 research-only + open-point card.
      llmResult = {
        type: "criminal" as const,
        concept: chq === "balance" ? "صك:فحص:رصيد" : "صك:فحص:سبب",
        discuss: [chq === "balance" ? "صك:فحص:رصيد" : "صك:فحص:سبب"],
      };
    } else if (alt) {
      // (g) Document alteration with authorization dispute: Arts. 122/123 research-only.
      llmResult = {
        type: "criminal" as const,
        concept: "تزوير:فحص",
        discuss: ["تزوير:فحص"],
      };
    } else {
      // (d) Fire damage: discuss-only path — Art. 182 lives in the إتلاف:بيّنة card,
      // not in the primary laws array (CONCEPT_TO_ARTICLES["إتلاف:بيّنة"] = []).
      llmResult = {
        type: "criminal" as const,
        concept: "إتلاف:بيّنة",
        discuss: ["إتلاف:بيّنة"],
      };
    }
    // anyFired is set by the else branch below (llmResult.type is now "criminal").
  }
  // Commit 38: when the LLM labels the case "civil" but facts show property damage
  // with a rescue or accident context, surface the open-point card instead.
  // This handles cases where the compensation framing misleads the LLM (B12-03,
  // B12-06). Pure civil cases (no property-damage verb) pass through unchanged.
  if (llmResult.type === "civil" && factsMatchPropertyDamage(input.facts)) {
    if (factsMatchRescueNecessity(input.facts)) {
      llmResult = {
        type: "criminal" as const,
        concept: "إباحة:ضرورة",
        discuss: ["إباحة:ضرورة"],
      };
    } else if (
      factsMatchAccidentMarker(input.facts) &&
      !factsMatchIntentToKill(input.facts) &&
      !factsMatchDeliberateAssault(input.facts)
    ) {
      llmResult = {
        type: "criminal" as const,
        concept: "إباحة:عرضي",
        discuss: ["إباحة:عرضي"],
      };
    }
  }
  // Commit 46: civil LLM + entrustment facts → Art. 177 research-only + open-point card.
  // Must run BEFORE the civil-clear block so the criminal path is not suppressed.
  // TODO: Lawyer 2026-10-24: civil must not be suppressed — unify in a later commit (civil + card).
  if (llmResult.type === "civil" && factsMatchEntrustment(input.facts)) {
    llmResult = {
      type: "criminal" as const,
      concept: "أمانة:مدني",
      discuss: ["أمانة:مدني"],
    };
  }
  // Commit 48 block (C): civil LLM + cheque dishonour → Art. 179 research-only + card.
  // After this conversion llmResult.type is "criminal" so the civil text search does NOT run.
  // TODO: Lawyer 2026-10-24: civil must not be suppressed — unify in a later commit (civil + card).
  if (llmResult.type === "civil" && chq !== null) {
    llmResult = {
      type: "criminal" as const,
      concept: chq === "balance" ? "صك:فحص:رصيد" : "صك:فحص:سبب",
      discuss: [chq === "balance" ? "صك:فحص:رصيد" : "صك:فحص:سبب"],
    };
  }
  if (llmResult.type === "civil") {
    // Suppress criminal path — civil text search runs below
    anyFired = false;
    criminalTerms = [];
  } else {
    // LLM is authoritative: replace word-list concepts with the LLM concept.
    // Item 4: for انتحال, split into sub-concepts based on keyword gates so that
    // Art. 93/113/60 are shown only when the facts support their specific scope.
    if (llmResult.concept === "انتحال") {
      const isOfficialImpersonation =
        factsMatchKeywords(input.facts, IMPOSTOR_VERB_KW) &&
        factsMatchClaimMarker(input.facts, PUBLIC_OFFICIAL_KW);
      if (isOfficialImpersonation && factsMatchMoneyTake(input.facts)) {
        // Fraud is the primary charge; impersonation of official is the method.
        // Override to احتيال (Art. 178 rank 1); Art. 93 injected via discussConcepts.
        criminalTerms = [{ term: "احتيال", origin: "expanded" as const }];
        officialImpersonatorGateFired = true;
      } else {
        const subTerms: string[] = [];
        if (factsMatchKeywords(input.facts, PUBLIC_OFFICIAL_KW)) subTerms.push("انتحال:موظف");
        if (factsMatchKeywords(input.facts, LEGAL_PROCEEDING_KW)) subTerms.push("انتحال:دعوى");
        if (factsMatchKeywords(input.facts, UNIFORM_KW)) subTerms.push("انتحال:زي");
        // If no gate fires, fall back to "انتحال" (empty map) → noConfidentMatch.
        criminalTerms = subTerms.length > 0
          ? subTerms.map((t) => ({ term: t, origin: "expanded" as const }))
          : [{ term: "انتحال", origin: "expanded" as const }];
      }
    } else {
      criminalTerms = [{ term: llmResult.concept, origin: "expanded" as const }];
      // Case 7 fix: Art. 157 (hadd qadhf) only for an imputation of zina, liwat or
      // denial of lineage. Any other insult ("حرامي") → Art. 160, with Art. 159 card.
      if (llmResult.concept === "قذف" && !factsMatchQadhfImputation(input.facts)) {
        llmResult = { ...llmResult, concept: "إساءة وسباب" };
        criminalTerms = [{ term: "إساءة وسباب", origin: "expanded" as const }];
        qadhfDowngraded = true;
      }
      // Commit 37 — B12-02: extortion without a money/document demand is not Art. 176.
      // Override to تهديد (Art. 144); the فحص card is injected below.
      if (llmResult.concept === "ابتزاز" && !factsMatchMoneyDemand(input.facts)) {
        llmResult = { ...llmResult, concept: "تهديد" };
        criminalTerms = [{ term: "تهديد", origin: "expanded" as const }];
      }
      // Commit 41: extortion attempt — demand made (kept as ابتزاز above) but delivery
      // did not occur → شروع:ابتزاز (Arts. 20/176/19). If delivery occurred: Art. 176.
      if (llmResult.concept === "ابتزاز" && !factsMatchDelivery(input.facts)) {
        criminalTerms = [{ term: "شروع:ابتزاز", origin: "expanded" as const }];
      }
      // Commit 41: hadd upgrade — all five preconditions explicitly stated → سرقة:حدية.
      if (llmResult.concept === "سرقة" && factsMatchHaddTheftConditions(input.facts)) {
        criminalTerms = [{ term: "سرقة:حدية", origin: "expanded" as const }];
      }
      // Commit 38 — damage/trespass concepts: when the context shows necessity or
      // accident (without intent), drop the primary article and show an إباحة card.
      // B12-07 (intentional laptop) and theft+damage cases must remain unchanged.
      const _DAMAGE_TRESPASS = new Set(["إتلاف جنائي", "تعدٍّ", "اقتحام"]);
      if (_DAMAGE_TRESPASS.has(llmResult.concept)) {
        if (factsMatchRescueNecessity(input.facts)) {
          llmResult = { ...llmResult, concept: "إباحة:ضرورة", discuss: ["إباحة:ضرورة"] };
          criminalTerms = [{ term: "إباحة:ضرورة", origin: "expanded" as const }];
        } else if (
          factsMatchAccidentMarker(input.facts) &&
          !factsMatchIntentToKill(input.facts) &&
          !factsMatchDeliberateAssault(input.facts)
        ) {
          llmResult = { ...llmResult, concept: "إباحة:عرضي", discuss: ["إباحة:عرضي"] };
          criminalTerms = [{ term: "إباحة:عرضي", origin: "expanded" as const }];
        }
      }
    }
    // Governing rule — docs/abu-rannat-governing-rules.md:
    // لا نستنتج القصد من السلاح وحده، ولا ننفيه من أقوال المتهم وحدها،
    // ولا نجزم بوصف الإصابة دون سند كافٍ.
    // Homicide open-point gate: when death after assault but no lethal weapon
    // and no explicitly stated intent to kill, show Art. 129 only and open
    // a card for the lawyer to determine 130 (عمد) vs 131 (شبه عمد).
    if (
      (llmResult.concept === "قتل عمد" || llmResult.concept === "قتل شبه عمد") &&
      !factsMatchLethalWeapon(input.facts) &&
      !factsMatchLethalMethod(input.facts) &&
      !factsMatchIntentToKill(input.facts)
    ) {
      criminalTerms = [{ term: "قتل:وصف", origin: "expanded" as const }];
    }
    // Change 2 — lethal means, but the FACTS negate intent at the narrator level:
    // "دون قصد قتله" / "ولم يكن يقصد قتله" etc., NOT the accused's denial.
    // When a lethal weapon or method is used but the narrative itself states no
    // intent, the homicide characterisation is open — override to قتل:وصف.
    if (
      (llmResult.concept === "قتل عمد" || llmResult.concept === "قتل شبه عمد") &&
      (factsMatchLethalWeapon(input.facts) || factsMatchLethalMethod(input.facts)) &&
      factsNegateIntentToKill(input.facts)
    ) {
      criminalTerms = [{ term: "قتل:وصف", origin: "expanded" as const }];
    }
    // Deliberate-assault override: when the LLM returns قتل خطأ but the act
    // was a deliberate assault (ضرب/لكم/ركل/طعن/هاجم/خنق/دفعه/...), the
    // killing type is open — شبه عمد or عمد, not خطأ. Override to قتل:وصف.
    // This path never yields Art. 130 (intent not established) or Art. 132.
    if (
      llmResult.concept === "قتل خطأ" &&
      factsMatchDeliberateAssault(input.facts)
    ) {
      criminalTerms = [{ term: "قتل:وصف", origin: "expanded" as const }];
    }
    // Lethal-means override: when the LLM returns جرح خطأ but facts contain a
    // lethal method or lethal weapon, the wounding type is open — override to
    // جرح عمد so the method/weapon/injury-description gates run normally.
    if (
      llmResult.concept === "جرح خطأ" &&
      (whichLethalMethod(input.facts) !== null ||
        factsMatchLethalWeapon(input.facts))
    ) {
      llmResult = { ...llmResult, concept: "جرح عمد" };
    }
    // R1 — Engine never asserts Art. 131. When none of the gates above have
    // overridden قتل شبه عمد, force to قتل:وصف (Art. 129 + open-point card).
    if (
      llmResult.concept === "قتل شبه عمد" &&
      criminalTerms[0]?.term === "قتل شبه عمد"
    ) {
      criminalTerms = [{ term: "قتل:وصف", origin: "expanded" as const }];
    }
    anyFired = true;
  }

  const inferredCriminal = anyFired;

  // Commit 49 Blocks C + C-2 (revised per Addendum 3): civil + alt and/or off124 →
  // attach research card(s) WITHOUT converting to criminal or suppressing civil search.
  // Order: تزوير:فحص first (alt), then تزوير:موظف (off124). Deduped by concept.
  const adminReview = factsMatchAdminAppointmentReview(input.facts);
  const civilDiscussItems: DiscussItem[] = [];
  if (!inferredCriminal) {
    const seen = new Set<string>();
    if (alt) {
      const item = await buildCivilDiscussItem("تزوير:فحص", supabase);
      if (item && !seen.has(item.concept)) { seen.add(item.concept); civilDiscussItems.push(item); }
    }
    if (off124) {
      const item = await buildCivilDiscussItem("تزوير:موظف", supabase);
      if (item && !seen.has(item.concept)) { seen.add(item.concept); civilDiscussItems.push(item); }
    }
    // Commit 52: admin appointment review card — fires on civil/abstain path.
    if (adminReview !== null) {
      const concept = "قرار:مشروعية";
      if (!seen.has(concept)) {
        seen.add(concept);
        const conflLine = adminReview === "conflict"
          ? DISCUSS_CONCEPT_CONFLICT_LINE[concept]
          : undefined;
        civilDiscussItems.push({
          concept,
          label: DISCUSS_CONCEPT_LABEL[concept],
          ...(DISCUSS_CONCEPT_DESC[concept]     ? { description:  DISCUSS_CONCEPT_DESC[concept]     } : {}),
          ...(DISCUSS_CONCEPT_EVIDENCE[concept] ? { evidenceLine: DISCUSS_CONCEPT_EVIDENCE[concept] } : {}),
          ...(DISCUSS_CONCEPT_CAUTION[concept]  ? { cautionLine:  DISCUSS_CONCEPT_CAUTION[concept]  } : {}),
          ...(conflLine                         ? { conflictLine: conflLine                          } : {}),
          articles: [],
        });
      }
    }
  }

  const caseTypeFull = await resolveCaseTypeFull(
    supabase,
    anyFired ? undefined : input.caseType,
    inferredCriminal,
  );

  // Commit 43, Fix 1: lab-pending gate is deterministic — fires regardless of LLM
  // result so it is reachable when the LLM abstains or returns civil.
  const labPending =
    factsMatchNarcoticsContext(input.facts) && factsMatchLabPending(input.facts);
  if (labPending) {
    const labCaseType =
      caseTypeFull?.slug === "criminal"
        ? caseTypeFull
        : await resolveCaseTypeFull(supabase, undefined, true);
    if (labCaseType) {
      const cmResult = await analyzeCriminalConceptMap(
        supabase, input, labCaseType, [], excerpt, truncated, ["مخدرات:معمل"],
      );
      return { ...cmResult, laws: [], noConfidentMatch: false, hasAnyResults: true };
    }
  }

  // Criminal cases use a deterministic concept-map path — no text search for laws.
  if (caseTypeFull?.slug === "criminal") {
    // Capture the original LLM concept before any gate may override llmResult.
    // Used for relatedLaws (Change C, Commit 40): جرح خطأ may be overridden to
    // جرح عمد by the lethal-method gate below, but the traffic law still applies.
    const origLlmConcept = llmResult.type === "criminal" ? llmResult.concept : null;

    // Item 2: filter the LLM's attempted-murder discuss suggestion to stabbings
    // and shootings only. A stick blow in a fight should not trigger it.
    const rawDiscuss = llmResult.type === "criminal" ? (llmResult.discuss ?? []) : [];
    let filteredDiscuss = rawDiscuss.filter((c) => {
      // Always drop LLM's "قتل عمد" — the deterministic gates below replace it.
      if (c === "قتل عمد") return false;
      // Always drop LLM's "اشتراك:فحص" — the keyword gate (factsMatchParticipation) owns this.
      if (c === "اشتراك:فحص") return false;
      // Robbery-with-wound card: LLM proposes + keyword gate both required.
      if (c === "نهب:جرح") return factsMatchWound(input.facts);
      return true;
    });

    // Serious-injury gates (Commit 33): bone fracture or hot/caustic liquid pour.
    // Gate C.1: stated intent + serious injury → attempt (شروع:قتل) as primary concept.
    // Gate C.2: serious injury without stated intent → جرح عمد + review card [+ شروع:حرق if site].
    // Both gates supersede the method/weapon/Change-1 gates below.
    // Gate C.0 (Commit 35): جرح خطأ without a deliberate act stays negligence (Art. 141).
    //   If a serious injury is described, open the negligence card instead of the review card.
    const LIVING_VICTIM_CONCEPTS = new Set([
      "جرح عمد", "جرح شبه عمد", "جرح خطأ", "أذى", "قوة جنائية",
    ]);
    let seriousInjuryGateFired = false;
    if (
      llmResult.type === "criminal" &&
      LIVING_VICTIM_CONCEPTS.has(llmResult.concept)
    ) {
      const deliberateAct =
        factsMatchDeliberateAssault(input.facts) ||
        factsMatchIntentToKill(input.facts) ||
        // Pouring hot/caustic liquid on a person is inherently deliberate —
        // check directly so "صب عليه موية مغلية فكسر رجله" (both paths true)
        // still routes through C.2, not C.0.
        factsMatchHotLiquidPour(input.facts);
      if (llmResult.concept === "جرح خطأ" && !deliberateAct) {
        // C.0: negligence stays negligence — do not upgrade to جرح عمد.
        // Keep criminalTerms as-is (concept map already gives 141, 138).
        if (factsMatchSeriousInjury(input.facts)) {
          filteredDiscuss = [...filteredDiscuss, "إهمال:فحص"];
        }
        seriousInjuryGateFired = true;
      } else if (
        factsMatchIntentToKill(input.facts) &&
        factsMatchSeriousInjury(input.facts)
      ) {
        // C.1: attempt — stated intent is the classification; no extra attempt card
        criminalTerms = [{ term: "شروع:قتل", origin: "expanded" as const }];
        filteredDiscuss = [...filteredDiscuss, "إصابة:مراجعة"];
        seriousInjuryGateFired = true;
      } else if (factsMatchSeriousInjury(input.facts)) {
        // C.2: serious injury without explicit intent → جرح عمد + review card
        criminalTerms = [{ term: "جرح عمد", origin: "expanded" as const }];
        filteredDiscuss = [...filteredDiscuss, "إصابة:مراجعة"];
        if (factsMatchDangerousSite(input.facts)) {
          filteredDiscuss = [...filteredDiscuss, "شروع:حرق"];
        }
        seriousInjuryGateFired = true;
      }
    }

    // Change A (Commit 40): negligence open-point card for قتل خطأ.
    // Fires when the LLM returned قتل خطأ and no deliberate act or gross negligence
    // is present. Gross negligence (phone, drunk, red-light) is clear-cut and does
    // not need an open-point card — the law applies without ambiguity.
    if (
      llmResult.type === "criminal" &&
      llmResult.concept === "قتل خطأ" &&
      !factsMatchDeliberateAssault(input.facts) &&
      !factsMatchIntentToKill(input.facts) &&
      !factsMatchGrossNegligence(input.facts)
    ) {
      filteredDiscuss = [...filteredDiscuss, "إهمال:فحص:قتل"];
    }

    // Method gate: deterministic — does not depend on LLM volunteering discuss.
    // Fires when the act involved a lethal method (خنق/سم/حرق/إغراق/ذبح) and
    // the charge is a non-fatal bodily-harm concept.
    // When method fires, weapon gate is suppressed (one card per case).
    let methodCardFired = false;
    if (
      !seriousInjuryGateFired &&
      llmResult.type === "criminal" &&
      (llmResult.concept === "جرح عمد" ||
        llmResult.concept === "جرح شبه عمد" ||
        llmResult.concept === "أذى" ||
        llmResult.concept === "قوة جنائية")
    ) {
      const whichMethod = whichLethalMethod(input.facts);
      if (whichMethod !== null) {
        filteredDiscuss = [...filteredDiscuss, `شروع:${whichMethod}`];
        methodCardFired = true;
      }
    }

    // Weapon gate: deterministic — fires for جرح عمد + lethal weapon.
    // Skipped when the method gate already fired, so each case shows at most
    // one attempted-murder card.
    if (
      !seriousInjuryGateFired &&
      !methodCardFired &&
      llmResult.type === "criminal" &&
      llmResult.concept === "جرح عمد" &&
      factsMatchLethalWeapon(input.facts)
    ) {
      filteredDiscuss = [...filteredDiscuss, "شروع:سلاح"];
    }

    // Change 1 — lethal METHOD (خنق/سم/إغراق/حرق) + no stated wound + no lethal
    // weapon → injury characterisation is open.  Laws: Art. 138 only; add a
    // second "إصابة:وصف" card so the lawyer can determine 139 vs 142 from the
    // medical report.  The attempted-murder card from the method gate still shows.
    const OPEN_INJURY_METHODS = new Set(["خنق", "سم", "إغراق", "حرق"]);
    if (
      !seriousInjuryGateFired &&
      llmResult.type === "criminal" &&
      (llmResult.concept === "جرح عمد" ||
        llmResult.concept === "جرح شبه عمد" ||
        llmResult.concept === "أذى") &&
      OPEN_INJURY_METHODS.has(whichLethalMethod(input.facts) ?? "") &&
      !factsMatchWound(input.facts) &&
      !factsMatchLethalWeapon(input.facts)
    ) {
      criminalTerms = [{ term: "جرح:وصف", origin: "expanded" as const }];
      filteredDiscuss = [...filteredDiscuss, "إصابة:وصف"];
    }

    // Case 3 fix: a blow with a blunt, non-lethal instrument (عكاز/عصا/حجر) that
    // opened a wound does not settle intent. Unless the facts state intent in words,
    // primary becomes Art. 138 only and Arts. 139/140 move to an open-point card.
    if (
      !seriousInjuryGateFired &&
      llmResult.type === "criminal" &&
      criminalTerms[0]?.term === "جرح عمد" &&
      factsMatchBluntInstrument(input.facts) &&
      !factsMatchLethalWeapon(input.facts) &&
      !factsStateIntentWords(input.facts) &&
      !factsMatchIntentToKill(input.facts)
    ) {
      criminalTerms = [{ term: "جرح:وصف", origin: "expanded" as const }];
      if (!filteredDiscuss.includes("جراح:قصد")) filteredDiscuss = [...filteredDiscuss, "جراح:قصد"];
    }

    // Commit 37: تهديد (direct LLM or overridden from ابتزاز without money demand)
    // always gets the فحص card — Art. 144 is the primary, Art. 160 is the fallback.
    if (llmResult.type === "criminal" && llmResult.concept === "تهديد") {
      if (!filteredDiscuss.includes("تهديد:فحص")) {
        filteredDiscuss = [...filteredDiscuss, "تهديد:فحص"];
      }
    }

    // True when the homicide gate overrode the concept to قتل:وصف.
    const homicideOpenPoint = criminalTerms[0]?.term === "قتل:وصف";

    // Commit 42/43, Change E — routing gates for new research cards.
    const NARCOTICS_CONCEPTS = new Set([
      "مخدرات", "مخدرات:قصد الاتجار", "مخدرات:قصد التعاطي", "مخدرات:تقديم",
    ]);
    const isNarcoticsConcept =
      llmResult.type === "criminal" && NARCOTICS_CONCEPTS.has(llmResult.concept);

    // labPending was computed above (deterministic, before branching) and returned early.

    // E2a: stolen-goods knowledge dispute — test final primary term OR LLM concept.
    const stolenGoodsKnowledgeDisputed =
      llmResult.type === "criminal" &&
      (llmResult.concept === "استلام مسروق" || criminalTerms[0]?.term === "استلام مسروق") &&
      factsMatchKnowledgeDisputed(input.facts) === "disputed";

    // E2b: narcotics knowledge dispute (lab is not pending — we already returned if it were).
    const narcoticsKnowledgeDisputed =
      isNarcoticsConcept &&
      factsMatchKnowledgeDisputed(input.facts) === "disputed";

    // E3: consent contested in rape / indecent-acts cases.
    const _isConsentConcept =
      llmResult.type === "criminal" &&
      (llmResult.concept === "اغتصاب" || llmResult.concept === "أفعال فاحشة");
    const consentContested =
      _isConsentConcept && factsMatchConsentDisputed(input.facts) === "contested";

    // E4: indecent act in public place → review card.
    const PUBLIC_PLACE_KW = [
      "موقف", "الشارع", "الطريق", "السوق", "المحطة", "مكان عام", "أمام الناس",
    ];
    const indecencyPublicPlace =
      llmResult.type === "criminal" &&
      llmResult.concept === "أفعال فاحشة" &&
      factsMatchKeywords(input.facts, PUBLIC_PLACE_KW);

    // Build discuss concept list for the open-point cards.
    // labPending was handled as an early return above.
    // narcoticsKnowledgeDisputed, stolenGoodsKnowledgeDisputed, consentContested,
    // indecencyPublicPlace are injected as independent post-chain blocks (Commit 43).
    let discussConcepts: string[] | undefined =
        llmResult.type === "criminal" && llmResult.intentUnknown
        ? ["مخدرات:قصد الاتجار", "مخدرات:قصد التعاطي"]
        : llmResult.type === "criminal" && homicideOpenPoint
        ? ["قتل:وصف", ...filteredDiscuss]
        : llmResult.type === "criminal" && llmResult.concept === "سرقة"
        ? [
            // Commit 41: when all hadd conditions stated, use the review card; else standard research card.
            factsMatchHaddTheftConditions(input.facts) ? "حد:مراجعة" : "سرقة:حد",
            ...(factsMatchParticipation(input.facts) ? ["اشتراك:فحص"] : []),
            ...filteredDiscuss,
          ]
        : llmResult.type === "criminal" && llmResult.concept === "نهب"
        ? [
            // Commit 41: robbery with weapon in public place → open hiraba examination card.
            ...(factsMatchWeaponPublicPlace(input.facts) ? ["حرابة:فحص"] : []),
            ...(factsMatchParticipation(input.facts) ? ["اشتراك:فحص"] : []),
            ...filteredDiscuss,
          ]
        // Item 3: for clear dealing, add Art. 16 (تقديم) only when supply keywords match.
        : llmResult.type === "criminal" && llmResult.concept === "مخدرات" && !llmResult.intentUnknown
        ? [
            ...(factsMatchKeywords(input.facts, SUPPLY_TO_PERSON_KW) ? ["مخدرات:تقديم"] : []),
            ...filteredDiscuss,
          ]
        // Impersonation gate: احتيال path — Art. 178 stays rank 1, inject Art. 93 discuss.
        // Also fires when انتحال is overridden to احتيال (officialImpersonatorGateFired=true).
        : llmResult.type === "criminal" && (officialImpersonatorGateFired || (
            llmResult.concept === "احتيال" &&
            factsMatchKeywords(input.facts, IMPOSTOR_VERB_KW) &&
            factsMatchClaimMarker(input.facts, PUBLIC_OFFICIAL_KW)
          ))
        ? ["انتحال:موظف", ...filteredDiscuss]
        : llmResult.type === "criminal"
        ? [...filteredDiscuss]
        : undefined;

    // Change B (Commit 40): inject participation card for any criminal concept when
    // facts contain participation markers. The سرقة/نهب branches already inject it;
    // the !includes guard prevents duplicates.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      !discussConcepts.includes("اشتراك:فحص") &&
      factsMatchParticipation(input.facts)
    ) {
      discussConcepts = [...discussConcepts, "اشتراك:فحص"];
    }

    // Commit 43, Fix 2: Commit 42 cards injected as independent post-chain blocks so
    // they fire regardless of which ternary branch was taken (سرقة, احتيال, etc.).

    // E2a: stolen goods + disputed knowledge → علم:فحص:مسروق
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      stolenGoodsKnowledgeDisputed &&
      !discussConcepts.includes("علم:فحص:مسروق")
    ) {
      discussConcepts = [...discussConcepts, "علم:فحص:مسروق"];
    }

    // E2b: narcotics knowledge disputed → علم:فحص:مخدرات at front, intent cards removed.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      narcoticsKnowledgeDisputed
    ) {
      discussConcepts = [
        ...(!discussConcepts.includes("علم:فحص:مخدرات") ? ["علم:فحص:مخدرات"] : []),
        ...discussConcepts.filter(
          (c) => c !== "مخدرات:قصد الاتجار" && c !== "مخدرات:قصد التعاطي",
        ),
      ];
    }

    // E3: contested consent → رضا:فحص
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      consentContested &&
      !discussConcepts.includes("رضا:فحص")
    ) {
      discussConcepts = [...discussConcepts, "رضا:فحص"];
    }

    // Case 7 fix: qadhf cards — conditions card when Art. 157 is kept,
    // reputation-alternative card when it was dropped.
    if (llmResult.type === "criminal" && discussConcepts !== undefined) {
      const qCard = qadhfDowngraded
        ? "قذف:تحويل"
        : llmResult.concept === "قذف" ? "قذف:شروط"
        : llmResult.concept === "إشانة سمعة" ? "سباب:بديل"
        : llmResult.concept === "إساءة وسباب" ? "سمعة:بديل"
        : null;
      if (qCard && !discussConcepts.includes(qCard)) {
        discussConcepts = [qCard, ...discussConcepts.filter((c) => c !== "قذف" && c !== "إشانة سمعة")];
      }
    }

    // E4: indecency in public place → فاحشة:مراجعة
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      indecencyPublicPlace &&
      !discussConcepts.includes("فاحشة:مراجعة")
    ) {
      discussConcepts = [...discussConcepts, "فاحشة:مراجعة"];
    }

    // Commit 46: خيانة الأمانة (LLM direct) + contractual-defence marker → swap to research-only + add card.
    // Swapping criminalTerms ensures 177 always carries statusNoteOverride regardless of LLM type.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      llmResult.concept === "خيانة الأمانة" &&
      !discussConcepts.includes("أمانة:مدني") &&
      factsMatchContractualDefence(input.facts)
    ) {
      criminalTerms = [{ term: "أمانة:مدني", origin: "expanded" as const }];
      discussConcepts = [...discussConcepts, "أمانة:مدني"];
    }

    // Commit 50 block (A): خيانة الأمانة + entrustment + mere non-return → swap to research-only.
    // Fires only when no disposal act and no supported denial; bare denial or no denial both qualify.
    // Contractual-defence card (أمانة:مدني) already says mere non-return is insufficient, so skip.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      (llmResult.concept === "خيانة الأمانة" || criminalTerms[0]?.term === "خيانة الأمانة") &&
      factsMatchTrustNonReturn(input.facts) &&
      !factsMatchTrustDisposal(input.facts) &&
      factsMatchTrustDenial(input.facts) !== "supported" &&
      !discussConcepts.includes("أمانة:مدني")
    ) {
      criminalTerms = [{ term: "أمانة:فحص", origin: "expanded" as const }];
      if (!discussConcepts.includes("أمانة:فحص")) {
        discussConcepts = [...discussConcepts, "أمانة:فحص"];
      }
    }

    // Commit 48 block (A): صك مردود primary + dishonour detector → swap to research-only card.
    // Uses the same criminalTerms-reassignment mechanism as L2282-2292.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      (llmResult.concept === "صك مردود" || criminalTerms[0]?.term === "صك مردود")
    ) {
      if (chq === "balance" && factsMatchChequeBalanceClaim(input.facts)) {
        criminalTerms = [{ term: "صك:فحص:رصيد", origin: "expanded" as const }];
        if (!discussConcepts.includes("صك:فحص:رصيد")) {
          discussConcepts = [...discussConcepts, "صك:فحص:رصيد"];
        }
      } else if (chq === "stop" && factsMatchChequeStopCause(input.facts)) {
        criminalTerms = [{ term: "صك:فحص:سبب", origin: "expanded" as const }];
        if (!discussConcepts.includes("صك:فحص:سبب")) {
          discussConcepts = [...discussConcepts, "صك:فحص:سبب"];
        }
      }
      // chq fired but no matching claim → no change (absence of defence is not admission).
      // chq === null → no change.
    }

    // Commit 49 block (A): LLM says تزوير AND alt detector fires → swap to research-only card.
    // LLM تزوير WITHOUT alt → unchanged (122+123 as the LLM produced, no card injected).
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      (llmResult.concept === "تزوير" || criminalTerms[0]?.term === "تزوير")
    ) {
      if (alt) {
        criminalTerms = [{ term: "تزوير:فحص", origin: "expanded" as const }];
        if (!discussConcepts.includes("تزوير:فحص")) {
          discussConcepts = [...discussConcepts, "تزوير:فحص"];
        }
      }
    }

    // Commit 49 block (A) case 3: alt fires on a non-تزوير criminal concept → card only, no swap.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      alt &&
      criminalTerms[0]?.term !== "تزوير:فحص" &&
      !discussConcepts.includes("تزوير:فحص")
    ) {
      discussConcepts = [...discussConcepts, "تزوير:فحص"];
    }

    // Commit 49 block (D): independent post-chain gate — public-official false entry (Art. 124).
    // Fires on ANY criminal result regardless of the LLM concept; never touches primary laws.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      off124 &&
      !discussConcepts.includes("تزوير:موظف")
    ) {
      discussConcepts = [...discussConcepts, "تزوير:موظف"];
    }

    // Commit 52: admin appointment review card — fires on any criminal result when gate matches.
    if (
      llmResult.type === "criminal" &&
      discussConcepts !== undefined &&
      adminReview !== null &&
      !discussConcepts.includes("قرار:مشروعية")
    ) {
      discussConcepts = [...discussConcepts, "قرار:مشروعية"];
    }

    // Change C (Commit 40): attach traffic-law-2010 as related legislation when the
    // original LLM concept is قتل خطأ or جرح خطأ and facts mention a vehicle.
    const relatedLawSlugs: string[] = [];
    if (
      (origLlmConcept === "قتل خطأ" || origLlmConcept === "جرح خطأ") &&
      factsMatchVehicle(input.facts)
    ) {
      relatedLawSlugs.push("traffic-law-2010");
    }

    const cmResult = await analyzeCriminalConceptMap(
      supabase, input, caseTypeFull, criminalTerms, excerpt, truncated,
      discussConcepts,
    );

    // E2b (Commit 42/43): narcotics knowledge disputed → keep Art. 12 only as primary.
    if (narcoticsKnowledgeDisputed) {
      const NARCOTICS = "narcotics-psychotropic-substances-act-1994";
      const art12Only = cmResult.laws.filter(
        (l) => l.lawSlug === NARCOTICS && l.articleNumber === "12",
      );
      return {
        ...cmResult,
        laws: art12Only,
        issues: cmResult.issues.map((issue) =>
          issue.topLaw &&
          !(issue.topLaw.lawSlug === NARCOTICS && issue.topLaw.articleNumber === "12")
            ? { ...issue, topLaw: art12Only[0] ?? null }
            : issue,
        ),
        ...(relatedLawSlugs.length > 0 ? { relatedLaws: relatedLawSlugs } : {}),
      };
    }

    if (llmResult.type === "criminal" && llmResult.intentUnknown) {
      const NARCOTICS = "narcotics-psychotropic-substances-act-1994";
      // Arts. 16 and 20 are no longer in CONCEPT_TO_ARTICLES["مخدرات"] but
      // the guard is kept in case a future map change re-adds them.
      const isStrippedArt = (l: { lawSlug?: string | null; articleNumber?: string | null }) =>
        l.lawSlug === NARCOTICS &&
        (l.articleNumber === "15" || l.articleNumber === "16" || l.articleNumber === "20");
      const filteredLaws = cmResult.laws.filter((l) => !isStrippedArt(l));
      return {
        ...cmResult,
        laws: filteredLaws,
        issues: cmResult.issues.map((issue) =>
          issue.topLaw && isStrippedArt(issue.topLaw)
            ? { ...issue, topLaw: filteredLaws[0] ?? null }
            : issue,
        ),
        intentUnknown: true,
        ...(relatedLawSlugs.length > 0 ? { relatedLaws: relatedLawSlugs } : {}),
      };
    }

    return relatedLawSlugs.length > 0 ? { ...cmResult, relatedLaws: relatedLawSlugs } : cmResult;
  }

  // ── Phase 1: candidates ────────────────────────────────────────────────
  // A wider pool than will be shown. Which terms survive is decided by what
  // they find in the corpus, not by word frequency — in a short statement of
  // facts almost every word occurs exactly once, so frequency ranking is a
  // coin toss. Testing it that way dropped «الطلاق», «حضانة» and «غسل» from
  // their own cases purely on an alphabetical tie-break.
  const candidates: { term: string; origin: IssueLens["origin"] }[] = [];
  const seen = new Set<string>();
  const pushTerm = (term: string, origin: IssueLens["origin"]) => {
    const t = term.trim();
    if (!t || seen.has(t) || candidates.length >= CANDIDATE_LIMIT) return;
    seen.add(t);
    candidates.push({ term: t, origin });
  };

  for (const kw of splitKeywordsField(input.keywords)) pushTerm(kw, "keyword");
  // Criminal expansion terms come before the extracted pool: they carry the
  // statutory vocabulary that the facts may not contain at all ("سرقة" when
  // the lawyer wrote "أخذ").
  for (const ex of criminalTerms) pushTerm(ex.term, ex.origin);
  for (const ex of extractTerms(input.facts)) pushTerm(ex.term, ex.origin);

  // ── Phase 2: what does each candidate actually find? ───────────────────
  // Articles and cases come from quick_search_v4. `include_repealed: true`
  // mirrors /search: nothing is hidden, everything is labelled with its legal
  // force — a repealed provision a lawyer needs to read must still be findable.
  const probed = await Promise.all(
    candidates.map(async ({ term, origin }) => {
      const { data, error } = await supabase.rpc("quick_search_v4", {
        q: term,
        limit_rows: PER_TERM_LIMIT,
        include_repealed: true,
      });
      const rows = (error ? [] : (data ?? [])) as V4Row[];
      return { term, origin, rows };
    })
  );

  // Which terms are worth showing is decided by CONCENTRATION: of a term's
  // top article hits, what share falls in one law. A term that identifies a
  // legal issue lands inside one statute — «غسل» and «حضانة» score 1.00, every
  // hit in the Anti-Money-Laundering Act and the Personal Status Act
  // respectively. Narrative vocabulary scatters — «رأسه» hits four unrelated
  // laws, «الحائز» five.
  //
  // Two earlier rules were tried and discarded against these same six cases:
  // word frequency (in a short text every word occurs once, so the tie-break
  // decided, dropping «الطلاق» and «غسل» from their own cases), and "fewest
  // hits is most specific" (which promoted «بعصا» and «ساعتين» and pushed
  // «قتل» out of a homicide entirely).
  const concentrationOf = (rows: V4Row[]): number => {
    const articles = rows.filter((r) => r.result_type === "article").slice(0, 10);
    if (articles.length === 0) return 0;
    const byLaw = new Map<string, number>();
    for (const r of articles) {
      const key = r.law_slug ?? r.subtitle ?? "?";
      byLaw.set(key, (byLaw.get(key) ?? 0) + 1);
    }
    return Math.max(...byLaw.values()) / articles.length;
  };

  const originRank: Record<IssueLens["origin"], number> = {
    keyword: 0,
    expanded: 1,
    extracted: 2,
  };

  const scored = probed.map((p) => ({ ...p, concentration: concentrationOf(p.rows) }));

  // A term the lawyer typed is always kept, even empty-handed: they are owed
  // the answer "this matched nothing". A term this module derived earns its
  // place only by finding something, and a single stray hit is not evidence.
  const kept = scored
    .filter((p) => p.origin === "keyword" || p.rows.length >= 2)
    .sort((a, b) => {
      const aEmpty = a.rows.length === 0;
      const bEmpty = b.rows.length === 0;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      if (originRank[a.origin] !== originRank[b.origin]) {
        return originRank[a.origin] - originRank[b.origin];
      }
      if (a.concentration !== b.concentration) return b.concentration - a.concentration;
      return b.rows.length - a.rows.length;
    })
    .slice(0, MAX_TERMS);

  const terms = kept.map(({ term, origin }) => ({ term, origin }));

  // Empty-terms gate: all candidates were filtered out (< 2 DB hits each) and
  // no keywords were supplied — nothing to anchor a legal search on.
  if (terms.length === 0 && !input.keywords?.trim()) {
    return {
      factsExcerpt: excerpt,
      factsIsTruncated: truncated,
      caseTypeLens: null,
      inferredCaseType: null,
      issues: [], laws: [], cases: [], principles: [],
      outOfScopeCount: 0, noConfidentMatch: true, hasAnyResults: false,
      ...(civilDiscussItems.length > 0 ? { discuss: civilDiscussItems } : {}),
    };
  }

  // Safety gate: if every surviving term is a plain extracted word (no concept
  // or keyword), there is no legal anchor — return noConfidentMatch regardless
  // of concentration and regardless of whether a case type was resolved.
  // "اتصالات" here means phone calls, not the Telecom Act; "دفع" means payment,
  // not a specific statutory provision. Concentration is not the test because a
  // common word can score 1.0 in one law while meaning something completely
  // different in the facts.
  if (
    terms.length > 0 &&
    terms.every((t) => t.origin === "extracted") &&
    !input.keywords?.trim()
  ) {
    return {
      factsExcerpt: excerpt,
      factsIsTruncated: truncated,
      caseTypeLens: input.caseType?.trim()
        ? {
            input: input.caseType.trim(),
            categoryNameAr: caseTypeFull?.categoryNameAr ?? null,
            inferred: false,
          }
        : null,
      inferredCaseType: null,
      issues: [],
      laws: [], cases: [], principles: [],
      outOfScopeCount: 0, noConfidentMatch: true, hasAnyResults: false,
      ...(civilDiscussItems.length > 0 ? { discuss: civilDiscussItems } : {}),
    };
  }

  // ── Phase 3: laws and principles for the terms that survived ───────────
  // v4 returns neither, so those come from universal_search_v3 — and only for
  // the kept terms, to hold the request's query count down. The primary
  // category id is passed; companion laws are included via the in-scope
  // post-retrieval check rather than by calling v3 multiple times.
  const v3ByTerm = await Promise.all(
    terms.map(async ({ term }) => {
      const { data, error } = await supabase.rpc("universal_search_v3", {
        q: term,
        result_types: ["law", "principle"],
        filter_category_id: caseTypeFull?.categoryId ?? null,
        limit_per_type: V3_PER_TYPE,
        overall_limit: V3_OVERALL,
      });
      return { term, rows: (error ? [] : (data ?? [])) as V3Row[] };
    })
  );
  const v3Map = new Map(v3ByTerm.map((r) => [r.term, r.rows]));

  const perTerm = kept.map(({ term, rows }) => ({
    term,
    v4: rows,
    v3: v3Map.get(term) ?? [],
  }));

  const authorityMap = new Map<string, RetrievedAuthority>();
  const caseMap = new Map<string, RetrievedCase>();
  const principleMap = new Map<string, RetrievedPrinciple>();
  const termsWithHits = new Set<string>();

  const addTerm = (arr: string[], term: string) => {
    if (!arr.includes(term)) arr.push(term);
  };

  for (const { term, v4, v3 } of perTerm) {
    for (const row of v4) {
      if (row.result_type === "article") {
        const existing = authorityMap.get(row.entity_id);
        if (existing) {
          addTerm(existing.matchedTerms, term);
          existing.rank = Math.max(existing.rank, row.rank ?? 0);
        } else {
          authorityMap.set(row.entity_id, {
            id: row.entity_id,
            type: "article",
            title: row.title ?? "",
            lawTitle: row.subtitle ?? null,
            articleNumber: row.identifier ?? null,
            excerptHtml: row.snippet ?? "",
            verified: false,
            slug: row.slug,
            lawSlug: row.law_slug ?? null,
            sourceUrl: null,
            force: forceOf(row),
            legalStatus: row.legal_status ?? null,
            statusNote: row.status_note_ar ?? null,
            matchedTerms: [term],
            rank: row.rank ?? 0,
            inScope: false,
          });
        }
        termsWithHits.add(term);
      } else if (row.result_type === "case") {
        const existing = caseMap.get(row.entity_id);
        if (existing) {
          addTerm(existing.matchedTerms, term);
          existing.rank = Math.max(existing.rank, row.rank ?? 0);
        } else {
          caseMap.set(row.entity_id, {
            id: row.entity_id,
            title: row.title ?? "",
            courtName: null,
            year: row.year_val ?? null,
            judgmentDate: null,
            citation: row.subtitle ?? null,
            caseNumber: row.identifier ?? null,
            principle: null,
            excerptHtml: row.snippet ?? "",
            authority: "unverified",
            slug: row.slug,
            sourceUrl: null,
            matchedTerms: [term],
            inScope: false,
            rank: row.rank ?? 0,
            keywords: [],
            tags: [],
          });
        }
        termsWithHits.add(term);
      }
    }

    for (const row of v3) {
      if (row.result_type === "law") {
        const existing = authorityMap.get(row.entity_id);
        if (existing) {
          addTerm(existing.matchedTerms, term);
        } else {
          authorityMap.set(row.entity_id, {
            id: row.entity_id,
            type: "law",
            title: row.title ?? "",
            lawTitle: null,
            articleNumber: null,
            excerptHtml: row.headline ?? row.snippet ?? "",
            verified: false,
            slug: row.slug,
            lawSlug: row.slug,
            sourceUrl: null,
            force: forceOf(row),
            legalStatus: null,
            statusNote: row.status_note_ar ?? null,
            matchedTerms: [term],
            // v3 ranks are a different scale from v4's; law rows are ordered
            // among themselves only, below the article rows.
            rank: -1,
            inScope: Boolean(caseTypeFull),
          });
        }
        termsWithHits.add(term);
      } else if (row.result_type === "principle") {
        const existing = principleMap.get(row.entity_id);
        if (existing) {
          addTerm(existing.matchedTerms, term);
        } else {
          principleMap.set(row.entity_id, {
            id: row.entity_id,
            title: row.title ?? "",
            category: row.subtitle ?? null,
            summary: row.snippet ?? null,
            slug: row.slug,
            matchedTerms: [term],
            rank: row.rank ?? 0,
          });
        }
        termsWithHits.add(term);
      }
    }
  }

  // Field-selected follow-ups, bounded to the small candidate id sets.
  const lawIds = [...authorityMap.values()].filter((v) => v.type === "law").map((v) => v.id);
  const articleIds = [...authorityMap.values()].filter((v) => v.type === "article").map((v) => v.id);
  const caseIds = [...caseMap.keys()];

  const [lawsDetail, articlesDetail, casesDetail] = await Promise.all([
    lawIds.length
      ? supabase.from("laws").select("id, verified, source_url, category_id").in("id", lawIds)
      : Promise.resolve({ data: [] as { id: string; verified: boolean | null; source_url: string | null; category_id: string | null }[] }),
    articleIds.length
      ? supabase.from("articles").select("id, verified, law_id").in("id", articleIds)
      : Promise.resolve({ data: [] as { id: string; verified: boolean | null; law_id: string }[] }),
    caseIds.length
      ? supabase
          .from("cases")
          .select("id, verified, authority_status, court_id, year, judgment_date, case_number, citation_ar, principle_ar, source_url, category_id, keywords, tags, metadata")
          .in("id", caseIds)
      : Promise.resolve({ data: [] as Array<{
          id: string; verified: boolean | null; authority_status: string | null; court_id: string | null;
          year: number | null; judgment_date: string | null; case_number: string | null;
          citation_ar: string | null; principle_ar: string | null; source_url: string | null;
          category_id: string | null; keywords: unknown; tags: unknown; metadata: unknown;
        }> }),
  ]);

  // Parent laws of the matched articles: needed for source_url and for the
  // in-scope check — an article is in-scope when its law belongs to the
  // primary category OR is one of the companion laws for this case type.
  const parentLawIds = [...new Set((articlesDetail.data ?? []).map((a) => a.law_id))];
  const { data: parentLaws } = parentLawIds.length
    ? await supabase.from("laws").select("id, source_url, category_id").in("id", parentLawIds)
    : { data: [] as { id: string; source_url: string | null; category_id: string | null }[] };
  const parentById = new Map((parentLaws ?? []).map((l) => [l.id, l]));

  const lawDetailById = new Map((lawsDetail.data ?? []).map((l) => [l.id, l]));
  const articleDetailById = new Map((articlesDetail.data ?? []).map((a) => [a.id, a]));
  const companionIds = new Set(caseTypeFull?.companionLawIds ?? []);

  for (const entry of authorityMap.values()) {
    if (entry.type === "law") {
      const d = lawDetailById.get(entry.id);
      entry.verified = Boolean(d?.verified);
      entry.sourceUrl = d?.source_url ?? null;
      entry.inScope = Boolean(
        caseTypeFull && (
          d?.category_id === caseTypeFull.categoryId ||
          companionIds.has(entry.id)
        )
      );
    } else {
      const d = articleDetailById.get(entry.id);
      entry.verified = Boolean(d?.verified);
      const parent = d ? parentById.get(d.law_id) : undefined;
      entry.sourceUrl = parent?.source_url ?? null;
      entry.inScope = Boolean(
        caseTypeFull && (
          parent?.category_id === caseTypeFull.categoryId ||
          (d && companionIds.has(d.law_id))
        )
      );
    }
  }

  const courtIds = [...new Set((casesDetail.data ?? []).map((c) => c.court_id).filter(Boolean))] as string[];
  const { data: courts } = courtIds.length
    ? await supabase.from("courts").select("id, name_ar").in("id", courtIds)
    : { data: [] as { id: string; name_ar: string | null }[] };
  const courtNameById = new Map((courts ?? []).map((c) => [c.id, c.name_ar]));
  const caseDetailById = new Map((casesDetail.data ?? []).map((c) => [c.id, c]));

  for (const c of caseMap.values()) {
    const d = caseDetailById.get(c.id);
    if (!d) continue;
    c.courtName = d.court_id ? courtNameById.get(d.court_id) ?? null : null;
    c.year = d.year ?? c.year;
    c.judgmentDate = d.judgment_date ?? null;
    c.citation = d.citation_ar ?? c.citation;
    c.caseNumber = d.case_number ?? c.caseNumber;
    c.principle = d.principle_ar ?? null;
    c.sourceUrl = d.source_url ?? null;
    c.authority = caseAuthority(d);
    c.inScope = Boolean(caseTypeFull && d.category_id === caseTypeFull.categoryId);
    c.keywords = parseKwArr(d.keywords);
    c.tags = parseKwArr(d.tags);
  }

  // ── Ranking boosts derived from expanded statutory terms ─────────────────
  // Offence-defining articles (those whose title/excerpt contains "جريمة [term]")
  // rank above other articles inside their scope band — these are the statutes
  // that literally define the crime and must surface first. Articles 1–5
  // (general interpretation/definitions) rank below other in-scope articles
  // unless they are the only ones present. Cases whose text explicitly names the
  // expanded statutory term rank above cases that merely share a category.
  const expandedTermSet = new Set(criminalTerms.map((t) => t.term));
  const offenceDefiningIds = new Set(
    [...authorityMap.values()]
      .filter((e) => isOffenceDefiningFor(e, expandedTermSet))
      .map((e) => e.id)
  );
  const definitionsArticleIds = new Set(
    [...authorityMap.values()].filter(isDefinitionsArticle).map((e) => e.id)
  );
  // Ordering. In-scope results (primary category + companion laws) come first.
  // Within each band, in-force provisions precede repealed ones, then by rank.
  const forceOrder: Record<ForceStatus, number> = {
    in_force: 0,
    unknown: 1,
    under_review: 2,
    not_in_force: 3,
  };
  const lawList = [...authorityMap.values()].sort((a, b) => {
    if (a.inScope !== b.inScope) return a.inScope ? -1 : 1;
    if (a.type !== b.type) return a.type === "article" ? -1 : 1;
    // Offence-defining articles rank first within their scope band.
    const aOD = offenceDefiningIds.has(a.id);
    const bOD = offenceDefiningIds.has(b.id);
    if (aOD !== bOD) return aOD ? -1 : 1;
    // General interpretation/definitions articles (Arts 1–5) rank last within
    // their scope band so substantive provisions surface first.
    const aDef = definitionsArticleIds.has(a.id);
    const bDef = definitionsArticleIds.has(b.id);
    if (aDef !== bDef) return aDef ? 1 : -1;
    if (forceOrder[a.force] !== forceOrder[b.force]) return forceOrder[a.force] - forceOrder[b.force];
    return b.rank - a.rank;
  });

  const authorityOrder: Record<AuthorityLevel, number> = {
    verified: 0,
    unverified: 1,
    needs_review: 2,
    overruled: 3,
  };

  // When criminal terms fired (criminal case falling through to text-search),
  // apply precedent relevance classification — keep only direct/conditional.
  // For non-criminal cases (activeConcepts empty), retain the old sort ordering.
  const tsActiveConcepts = criminalTerms.map((t) => t.term);
  let caseList: RetrievedCase[];
  if (tsActiveConcepts.length > 0) {
    const tsClassified: RetrievedCase[] = [];
    for (const c of caseMap.values()) {
      const cMeta = caseDetailById.get(c.id);
      const rel = classifyPrecedent(
        [...c.keywords, ...c.tags], tsActiveConcepts, conceptMapJson,
        cMeta?.metadata as { engine_eligible?: boolean } | null
      );
      c.relevance = rel;
      if (rel.outcome === "direct" || rel.outcome === "conditional") {
        tsClassified.push(c);
      }
    }
    caseList = tsClassified.sort((a, b) => {
      if (a.inScope !== b.inScope) return a.inScope ? -1 : 1;
      const aD = a.relevance!.outcome === "direct";
      const bD = b.relevance!.outcome === "direct";
      if (aD !== bD) return aD ? -1 : 1;
      if (authorityOrder[a.authority] !== authorityOrder[b.authority]) {
        return authorityOrder[a.authority] - authorityOrder[b.authority];
      }
      return b.rank - a.rank;
    });
  } else {
    const caseExpandedMatchIds = new Set(
      [...caseMap.values()]
        .filter((c) => caseMatchesExpandedTerms(c, expandedTermSet))
        .map((c) => c.id)
    );
    caseList = [...caseMap.values()].sort((a, b) => {
      if (a.inScope !== b.inScope) return a.inScope ? -1 : 1;
      const aEM = caseExpandedMatchIds.has(a.id);
      const bEM = caseExpandedMatchIds.has(b.id);
      if (aEM !== bEM) return aEM ? -1 : 1;
      if (authorityOrder[a.authority] !== authorityOrder[b.authority]) {
        return authorityOrder[a.authority] - authorityOrder[b.authority];
      }
      return b.rank - a.rank;
    });
  }

  const principleList = [...principleMap.values()].sort((a, b) => b.rank - a.rank);

  // Suppress out-of-scope results only when there are enough in-scope ones to
  // be useful. The threshold is 3: below that, the corpus tagging may be
  // incomplete and suppressing would hide real evidence. The count of excluded
  // items is returned so the UI can show it rather than silently disappearing.
  const IN_SCOPE_THRESHOLD = 3;
  const inScopeLaws = lawList.filter((l) => l.inScope);
  const outScopeLawCount = lawList.length - inScopeLaws.length;
  const inScopeCases = caseList.filter((c) => c.inScope);
  const outScopeCaseCount = caseList.length - inScopeCases.length;

  const suppress = inScopeLaws.length >= IN_SCOPE_THRESHOLD;
  const finalLawList = suppress ? inScopeLaws : lawList;
  const finalCaseList = suppress ? inScopeCases : caseList;
  const outOfScopeCount = suppress ? outScopeLawCount + outScopeCaseCount : 0;

  // Per-term lens. A result belongs to every term that matched it, so an issue
  // no longer renders empty merely because another term outranked it.
  const issues: IssueLens[] = terms.map(({ term, origin }) => ({
    term,
    origin,
    topLaw: finalLawList.find((l) => l.matchedTerms.includes(term)) ?? null,
    topCase: finalCaseList.find((c) => c.matchedTerms.includes(term)) ?? null,
    topPrinciple: principleList.find((p) => p.matchedTerms.includes(term)) ?? null,
    searchedAndEmpty: !termsWithHits.has(term),
  }));

  const showLens = Boolean(input.caseType?.trim() || caseTypeFull?.inferred);

  return {
    factsExcerpt: excerpt,
    factsIsTruncated: truncated,
    caseTypeLens: showLens
      ? {
          input: input.caseType?.trim() ||
            (caseTypeFull?.inferred ? `${caseTypeFull.categoryNameAr ?? "جنائي"} (مستنتج)` : ""),
          categoryNameAr: caseTypeFull?.categoryNameAr ?? null,
          inferred: caseTypeFull?.inferred ?? false,
        }
      : null,
    inferredCaseType: caseTypeFull?.inferred ? (caseTypeFull.categoryNameAr ?? "جنائي") : null,
    issues,
    ...(civilDiscussItems.length > 0 ? { discuss: civilDiscussItems } : {}),
    // noConfidentMatch: case type was resolved but no result from the primary
    // category was found. Companion-law results (criminal-procedure, evidence)
    // count toward confidence only when matched by a non-extracted term — an
    // expansion or keyword — because extracted words like "الشرطة" that happen
    // to match procedural articles do not confirm the right question was asked.
    ...((): Pick<CaseMapResult, "laws" | "cases" | "principles" | "outOfScopeCount" | "noConfidentMatch" | "hasAnyResults"> => {
      const isConceptTerm = (t: string) =>
        terms.some((te) => te.term === t && te.origin !== "extracted");
      const confidentInScopeLaws = inScopeLaws.filter((l) => {
        const inPrimary =
          l.type === "law"
            ? lawDetailById.get(l.id)?.category_id === caseTypeFull?.categoryId
            : (() => {
                const d = articleDetailById.get(l.id);
                const parent = d ? parentById.get(d.law_id) : undefined;
                return parent?.category_id === caseTypeFull?.categoryId;
              })();
        if (inPrimary) return true;
        return l.matchedTerms.some(isConceptTerm);
      });
      const noConfidentMatch =
        caseTypeFull !== null &&
        confidentInScopeLaws.length === 0 &&
        (lawList.length > 0 || caseList.length > 0);
      if (noConfidentMatch) {
        return {
          laws: [], cases: [], principles: [],
          outOfScopeCount: 0, noConfidentMatch: true, hasAnyResults: false,
        };
      }
      return {
        laws: finalLawList.slice(0, DISPLAY_CAP),
        cases: finalCaseList.slice(0, DISPLAY_CAP),
        principles: principleList.slice(0, DISPLAY_CAP),
        outOfScopeCount,
        noConfidentMatch: false,
        hasAnyResults: lawList.length > 0 || caseList.length > 0 || principleList.length > 0,
      };
    })(),
  };
}
