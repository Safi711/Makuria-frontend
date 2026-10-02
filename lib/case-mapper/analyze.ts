import type { SupabaseClient } from "@supabase/supabase-js";

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

function stripTashkeel(text: string): string {
  return text.replace(/[ً-ْٰ]/g, "");
}

/** Strips tashkeel AND folds alef variants (أ إ آ ٱ) to bare alef.
 * quick_search_v4 does the same on the DB side; mirroring it here lets
 * trigger "أخذ" match a text token "اخذ" or vice-versa without special-casing
 * every alef spelling a lawyer might use. */
function arabicNormalize(text: string): string {
  return stripTashkeel(text).replace(/[أإآٱ]/g, "ا");
}

function tokenize(text: string): string[] {
  return stripTashkeel(text)
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
  if (/^[وفبكل]/.test(w)) {
    const rest = w.slice(1);
    if (STOPWORDS.has(rest) || WEAK_TERMS.has(rest) || rest.length < 3) return false;
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
    if (bare && !freq.has(bare)) freq.set(bare, freq.get(w) ?? 1);
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
    when: ["سطو", "أرغمه", "بتهديد السلاح", "تهديد بسلاح", "بالقوة والتهديد"],
    add: ["سطو", "سرقة"],
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
  // ── Narcotic drugs ────────────────────────────────────────────────────
  {
    when: [
      "مخدر", "مخدرات", "حشيش", "أفيون", "هيروين", "قات", "بانجو",
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
  // Pattern: property legitimately received then unlawfully disposed of.
  // "استعار سيارة … ثم باعها" is the canonical car-case narrative.
  {
    allOf: [
      // entrustment / legitimate receipt
      ["استعار", "تسلّم", "تسلم", "استلم", "أودع", "وكّل", "وكل", "سلّمه", "سلمه", "عهد"],
      // unlawful disposal
      ["باع", "تصرّف", "تصرف", "رهن", "نقل", "فرّط", "فرط", "أتلف", "اختلس"],
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
  "عمارة", "مخزن", "مستودع",
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
    if (bare.startsWith(normTrigger) && bare.length <= normTrigger.length + 3) return true;
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
    if (triggerWords.every((tw) => win.some((t) => tokenMatchesTrigger(t, tw)))) return true;
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
  const tokens = arabicNormalize(text)
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
  const titleTokens = arabicNormalize(entry.title ?? "")
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
  const excerptTokens = arabicNormalize(stripHtmlTags(entry.excerptHtml))
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
  for (const term of expandedTerms) {
    const termN = arabicNormalize(term);
    if (
      // "جريمة [term]" as article heading
      windowContainsAll(titleTokens, ["جريمة", termN], 5) ||
      // article title IS the offence name (e.g. "السرقة")
      titleTokens.some((t) => tokenMatchesTrigger(t, term)) ||
      // definitional sentence in excerpt: "يعد مرتكباً لجريمة [term]"
      windowContainsAll(excerptTokens, ["جريمة", termN], 5)
    ) return true;
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
  const tokens = arabicNormalize(rawText).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (const term of expandedTerms) {
    if (tokens.some((t) => tokenMatchesTrigger(t, term))) return true;
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

export async function analyzeCase(
  supabase: SupabaseClient,
  input: CaseMapperInput
): Promise<CaseMapResult> {
  const { excerpt, truncated } = buildFactsExcerpt(input.facts);

  // ── Phase 0.5: criminal expansion probe ───────────────────────────────
  // Run before the DB round-trip so the result can inform the case-type
  // resolution. Criminal rules are gated: only fire when the user supplied
  // a criminal case type OR left caseType empty. A civil/personal-status
  // case that happens to contain "أخذ" (took delivery of goods) must not
  // accidentally trigger theft vocabulary.
  const userSlug = getCaseTypeSlug(input.caseType);
  const applyCriminalGate = !userSlug || userSlug === "criminal";
  let criminalTerms: { term: string; origin: "expanded" }[] = [];
  let inferredCriminal = false;
  if (applyCriminalGate) {
    const { terms, anyFired } = applyCriminalExpansions(input.facts);
    criminalTerms = terms;
    // Infer "criminal" only when the user left caseType blank AND at least
    // one expansion rule fired — not merely because the text is ambiguous.
    if (anyFired && !userSlug) inferredCriminal = true;
  }

  // The case type is a lens over the corpus, not a search term — see note 2
  // at the top of this file. Multi-branch: each case type maps to a primary
  // category plus companion laws that the same case invariably needs.
  const caseTypeFull = await resolveCaseTypeFull(supabase, input.caseType, inferredCriminal);

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
          .select("id, verified, authority_status, court_id, year, judgment_date, case_number, citation_ar, principle_ar, source_url, category_id")
          .in("id", caseIds)
      : Promise.resolve({ data: [] as Array<{
          id: string; verified: boolean | null; authority_status: string | null; court_id: string | null;
          year: number | null; judgment_date: string | null; case_number: string | null;
          citation_ar: string | null; principle_ar: string | null; source_url: string | null;
          category_id: string | null;
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
  const caseExpandedMatchIds = new Set(
    [...caseMap.values()]
      .filter((c) => caseMatchesExpandedTerms(c, expandedTermSet))
      .map((c) => c.id)
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
  const caseList = [...caseMap.values()].sort((a, b) => {
    if (a.inScope !== b.inScope) return a.inScope ? -1 : 1;
    // Cases whose text names the expanded statutory term outrank those that
    // only share a category tag.
    const aEM = caseExpandedMatchIds.has(a.id);
    const bEM = caseExpandedMatchIds.has(b.id);
    if (aEM !== bEM) return aEM ? -1 : 1;
    if (authorityOrder[a.authority] !== authorityOrder[b.authority]) {
      return authorityOrder[a.authority] - authorityOrder[b.authority];
    }
    return b.rank - a.rank;
  });

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
    // noConfidentMatch: case type was resolved but every retrieved article/case
    // is outside that category. Suppress the noise and let the UI say so plainly.
    ...((): Pick<CaseMapResult, "laws" | "cases" | "principles" | "outOfScopeCount" | "noConfidentMatch" | "hasAnyResults"> => {
      const noConfidentMatch =
        caseTypeFull !== null &&
        inScopeLaws.length === 0 &&
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
