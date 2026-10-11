/**
 * Keyword-matching utilities shared by analyze.ts and all __tests__ scripts.
 * No framework dependencies, no browser APIs.
 *
 * All text is normalised with normalizeForKwMatch before matching so
 * ة/ى/tashkeel/alef variants are folded before any comparison.
 */

// ── Normalisation ────────────────────────────────────────────────────────────

/** @param {string} text @returns {string} */
export function stripTashkeel(text) {
  return text.replace(/[ً-ْٰ]/g, "");
}

/** Folds tashkeel + alef variants + ة→ه + ى→ي, and converts Arabic
 * punctuation (،؛؟.) to spaces so they act as token delimiters.
 * @param {string} text @returns {string} */
export function normalizeForKwMatch(text) {
  return stripTashkeel(text)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[،؛؟.]/g, " ");
}

// ── Article / prefix stripping ───────────────────────────────────────────────

/** Multi-char prefixes only. Single-char prefixes (و ف ب ل ك) are handled
 * by direct comparison in tokenMatchesKw — never stripped from the token. */
export const KW_ARTICLE_PREFIXES = ["وال", "فال", "بال", "كال", "لل", "ال"];

/** Single-char prefixes accepted only as exact token = prefix + keyword. */
const SINGLE_CHAR_PREFIXES = ["و", "ف", "ب", "ل", "ك"];

/** @param {string} token @returns {string} */
export function stripKwArticle(token) {
  for (const p of KW_ARTICLE_PREFIXES) {
    if (token.startsWith(p) && token.length > p.length + 1) return token.slice(p.length);
  }
  return token;
}

// ── Closed suffix sets (all values already normalised: ة→ه, ى→ي) ─────────────

const PRONOUNS = new Set(["ه", "ها", "هم", "هن", "ك", "كم", "ني", "نا"]);
// Longest alternatives first so "وا" is tried before bare "و".
const VERB_ENDINGS = ["وا", "ت", "و", "ا", "ن"];
const NOUN_ENDINGS = new Set(["ه", "ين", "ون", "ات", "ان", "ي"]);

/** True when `rest` is a valid Arabic suffix: a pronoun, a noun ending, or a
 * verb ending optionally followed by one attached pronoun.
 * @param {string} rest @returns {boolean} */
function isSuffix(rest) {
  if (!rest) return false;
  if (PRONOUNS.has(rest)) return true;
  if (NOUN_ENDINGS.has(rest)) return true;
  for (const ve of VERB_ENDINGS) {
    if (rest === ve) return true;
    if (rest.startsWith(ve) && PRONOUNS.has(rest.slice(ve.length))) return true;
  }
  return false;
}

// ── Core token matcher ───────────────────────────────────────────────────────

/** Returns true when textToken matches kwToken as:
 *  1. Exact match.
 *  2. Multi-char article/prefix stripped form equals kwToken.
 *  3. Single-char prefix: textToken === prefix + kwToken (no suffix allowed).
 *  4. kwToken + closed suffix (pronoun / verb ending / noun ending).
 *  5. Same as 4 but on the article-stripped form.
 *
 * Open startsWith is intentionally absent: it produced false matches like
 * وزعم → وزع and مأمورية → مأمور.
 *
 * @param {string} textToken @param {string} kwToken @returns {boolean} */
export function tokenMatchesKw(textToken, kwToken) {
  if (textToken === kwToken) return true;
  const stripped = stripKwArticle(textToken);
  if (stripped === kwToken) return true;
  for (const p of SINGLE_CHAR_PREFIXES) {
    if (textToken === p + kwToken) return true;
  }
  if (textToken.startsWith(kwToken) && textToken.length > kwToken.length) {
    if (isSuffix(textToken.slice(kwToken.length))) return true;
  }
  if (stripped !== textToken && stripped.startsWith(kwToken) && stripped.length > kwToken.length) {
    if (isSuffix(stripped.slice(kwToken.length))) return true;
  }
  return false;
}

// ── Multi-keyword scanner ─────────────────────────────────────────────────────

/** Returns true when any keyword from `keywords` appears in `facts`.
 * Single-token keywords use tokenMatchesKw; multi-token phrases require all
 * tokens to appear contiguously in order.
 * @param {string} facts @param {string[]} keywords @returns {boolean} */
export function factsMatchKeywords(facts, keywords) {
  const normFacts = normalizeForKwMatch(facts);
  const factsTokens = normFacts.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (const kw of keywords) {
    const kwTokens = normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
    if (kwTokens.length === 0) continue;
    if (kwTokens.length === 1) {
      if (factsTokens.some((t) => tokenMatchesKw(t, kwTokens[0]))) return true;
    } else {
      const n = kwTokens.length;
      for (let i = 0; i <= factsTokens.length - n; i++) {
        if (kwTokens.every((kt, j) => tokenMatchesKw(factsTokens[i + j], kt))) return true;
      }
    }
  }
  return false;
}

// ── Keyword constants ─────────────────────────────────────────────────────────

/** Item 2: attempted-murder open point fires only for stabbings and shootings.
 * Use factsMatchLethalWeapon() — not factsMatchKeywords(facts, LETHAL_WEAPON_KW) —
 * so that طعن/الطعن in a legal-appeal context (followed within 3 tokens by
 * الحكم/القرار/الاستئناف/النقض/المحكمة) is suppressed.
 * Excluded (must NOT open this article — blunt/brawl objects):
 *   عصا عصي  سفروق سفرق  جنزير جنازير  بوكس  نبلة */
export const LETHAL_WEAPON_KW = [
  // Stab / cut / impale implements
  "طعن", "طعنة", "سكين", "سكينة", "شوتال", "خنجر", "حربة", "رمح", "نشاب",
  "مطوة", "مطواة", "شفرة", "ساطور", "سواطير", "بلطة", "بلط",
  "سونكي", "قدب", "فأس", "كوكاب",
  // Sword — inflected/prefixed forms only; bare "سيف" is a personal name and is excluded
  "بسيف", "بالسيف", "السيف", "سيفاً",
  // Bladed household tools
  "بموس", "بالموس",
  // Firearms
  "طبنجة", "كلاشينكوف", "كلاشنكوف", "كلاش",
  "رصاص", "رصاصة", "مسدس", "بندقية", "سلاح ناري",
  // Shooting phrases
  "أطلق النار", "أطلق عليه النار", "إطلاق نار",
  "عيار ناري", "أعيرة نارية", "طلق ناري",
  // Generic weapon phrases — full phrase only; bare "أبيض" / "حادة" excluded
  "سلاح أبيض", "آلة حادة",
];

/** Item 3: Art. 16 discuss card fires only when supply-to-person verbs match. */
export const SUPPLY_TO_PERSON_KW = [
  "قدم له",
  "سلم له",
  "أعطاه",
  "أعطى",
  "يعطيه",
  "وزع",
  "يوزع",
  "ناول",
  "يناول",
  // bare "يسلم" dropped: fires on "يسلم نفسه للشرطة" even after token matching
];

/** Item 4: Art. 93 fires when facts mention a public-official role.
 * Bare "أمن" excluded — "حارس أمن" is a private guard, not a state official. */
export const PUBLIC_OFFICIAL_KW = [
  "موظف", "موظفين", "موظفي", "ضابط", "ضباط", "مأمور", "وزارة", "حكومي", "مباحث",
  // Full-phrase only:
  "أمن الدولة", "أمن دولة",
  "الاستخبارات العسكرية", "استخبارات عسكرية",
];

/** Item 4: Art. 113 fires only when facts mention a legal proceeding. */
export const LEGAL_PROCEEDING_KW = [
  "دعوى", "محكمة", "إقرار", "كفالة", "ضامن",
];

/** Item 4: Art. 60 fires only when facts mention a uniform or badge phrase.
 * Bare "زي" excluded: Sudanese colloquial "زي ما قال" = "just as ... said".
 * Bare "شارة" excluded: "شارة المرور" (traffic signal) would false-fire. */
export const UNIFORM_KW = [
  "زي رسمي", "زي عسكري", "زي الشرطة", "زي الجيش", "زي الأمن",
  "شارة الشرطة", "شارة رسمية", "شارة عسكرية",
];

/** Impersonation-gate: verbs used when posing as an official. */
export const IMPOSTOR_VERB_KW = [
  "انتحل", "منتحل", "انتحال صفة",
  "ادعى", "مدعي",
  "زعم",
  "أوهم",
  "تظاهر", "متظاهر",
  "قدم نفسه",
];

/** Impersonation-gate: verbs indicating receipt of money.
 * A verb followed by على/عليه/عليهم counts as "arrest", not receipt. */
export const TAKING_VERB_KW = ["قبض", "استلم", "أخذ", "تسلم", "تحصل", "حصل على"];

/** Impersonation-gate: nouns indicating money or property. */
export const MONEY_NOUN_KW = [
  "مبلغ", "مال", "أموال", "مبالغ", "نقود", "فلوس", "ثمن", "رسوم", "دفعة",
];

// ── Claim-marker gate helpers ─────────────────────────────────────────────────

export const CLAIM_MARKERS = new Set(
  ["أنه", "بأنه", "صفة", "شخصية"].map(normalizeForKwMatch)
);
export const FILLER_TOKENS = new Set(
  ["من", "يعمل", "في", "أحد", "أفراد"].map(normalizeForKwMatch)
);
export const ARREST_POSTFIX = new Set(
  ["على", "عليه", "عليهم", "عليها", "عليهن"].map(normalizeForKwMatch)
);

/** Returns true when a claim marker (أنه/بأنه/صفة/شخصية) is followed by a
 * public-official keyword within at most 2 filler tokens, and the
 * official-keyword token does NOT start with ل.
 * @param {string} facts @param {string[]} officialKws @returns {boolean} */
export function factsMatchClaimMarker(facts, officialKws) {
  const normFacts = normalizeForKwMatch(facts);
  const tokens = normFacts.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const normOffKws = officialKws
    .map((k) => normalizeForKwMatch(k).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean)[0])
    .filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (!CLAIM_MARKERS.has(tokens[i])) continue;
    for (let skip = 0; skip <= 2; skip++) {
      const j = i + 1 + skip;
      if (j >= tokens.length) break;
      let allFillers = true;
      for (let k = i + 1; k < j; k++) {
        if (!FILLER_TOKENS.has(tokens[k])) { allFillers = false; break; }
      }
      if (!allFillers) break;
      if (tokens[j].startsWith("ل")) continue;
      if (normOffKws.some((ok) => tokenMatchesKw(tokens[j], ok))) return true;
    }
  }
  return false;
}

/** Returns true when the facts contain a taking verb NOT followed by
 * على/عليه/عليهم (arrest) AND a money noun.
 * @param {string} facts @returns {boolean} */
export function factsMatchMoneyTake(facts) {
  const normFacts = normalizeForKwMatch(facts);
  const tokens = normFacts.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const normVerbKws = TAKING_VERB_KW
    .map((k) => normalizeForKwMatch(k).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean))
    .filter((kts) => kts.length > 0);
  let foundTakingVerb = false;
  for (let i = 0; i < tokens.length; i++) {
    const isVerb = normVerbKws.some((kts) =>
      kts.length === 1
        ? tokenMatchesKw(tokens[i], kts[0])
        : kts.every((kt, j) => i + j < tokens.length && tokenMatchesKw(tokens[i + j], kt))
    );
    if (!isVerb) continue;
    const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (nextTok !== null && ARREST_POSTFIX.has(nextTok)) continue;
    foundTakingVerb = true;
    break;
  }
  if (!foundTakingVerb) return false;
  return factsMatchKeywords(facts, MONEY_NOUN_KW);
}

// ── Concept-list filter ───────────────────────────────────────────────────────

/** Wound (جرح عمد, Art. 139) supersedes a bruise (أذى, Art. 142).
 * When جرح عمد is in the concept terms list, drop أذى so Art. 142 is not shown.
 * When جرح عمد is absent, أذى behaves exactly as before.
 * @param {string[]} terms @returns {string[]} */
export function dropAthaIfWound(terms) {
  if (!terms.includes("جرح عمد")) return terms;
  return terms.filter((t) => t !== "أذى");
}

/** When جرح عمد is present, bare جرح is redundant (both map to Art. 138/139).
 * Drop it so the wound block appears once, not twice.
 * When جرح عمد is absent, جرح is unchanged.
 * @param {string[]} terms @returns {string[]} */
export function dropBareJurhIfWound(terms) {
  if (!terms.includes("جرح عمد")) return terms;
  return terms.filter((t) => t !== "جرح");
}

// ── Wound-presence gate (Commit 12) ──────────────────────────────────────────

/** Wound words that confirm a physical injury actually occurred.
 * Covers the جرح root, head-gash (شج), bleeding (نزيف/نزف), and pierce (غرز).
 * "كسر" (fracture) is intentionally excluded here — bone-fracture detection is
 * handled separately by factsMatchBoneBreak to avoid false fires on broken objects
 * (كسر قفل / كسر باب).
 * Each keyword is matched with full suffix/article handling via factsMatchKeywords. */
export const WOUND_KW = [
  // جرح root: wound/cut — جرحه، الجرح، جرحاً، جروح, مجروح
  "جرح",
  "جروح",
  "مجروح",
  // شج: gash/wound the scalp — شجّه، شجّا، شجّوه
  "شج",
  // نزيف / نزف: bleeding/hemorrhage
  "نزيف",
  "نزف",
  // غرز: to pierce — غرزه، غرز سكينه
  "غرز",
];

/** Body parts whose fracture signals a wound.  Only anatomy — no objects. */
const BODY_PART_KW = [
  "يد", "ذراع", "رجل", "ساق", "فخذ", "كتف",
  "عظم", "عظام",
  "أنف", "فك", "جمجمة", "صدر", "ضلع",
  "كوع", "ركبة", "رقبة", "قدم", "إصبع",
  "رأس",
];

/** Returns true when "كسر" (in any inflected form) appears in the facts
 * AND a body-part word is within ±4 tokens of it.
 * This avoids false fires on "كسر قفل المتجر" or "كسر باب المخزن".
 * The two-pass prefix-strip (covering فكسر / وكُسرت) matches the logic in
 * factsMatchWound so both passes find the كسر token position.
 * @param {string} facts @returns {boolean} */
function factsMatchBoneBreak(facts) {
  const norm = normalizeForKwMatch(facts);
  const tokens = norm.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const prefixes = ["و", "ف", "ب", "ل", "ك"];
  const bpNorm = BODY_PART_KW.map(normalizeForKwMatch);
  const KSR = normalizeForKwMatch("كسر");

  // Find all positions where a كسر token appears (with or without prefix).
  const positions = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (tokenMatchesKw(t, KSR)) { positions.push(i); continue; }
    if (t.length >= 2 && prefixes.includes(t[0]) && tokenMatchesKw(t.slice(1), KSR)) {
      positions.push(i);
    }
  }
  if (positions.length === 0) return false;

  // For each كسر position, check ±4 tokens for a body part.
  for (const pos of positions) {
    const lo = Math.max(0, pos - 4);
    const hi = Math.min(tokens.length - 1, pos + 4);
    for (let j = lo; j <= hi; j++) {
      if (j === pos) continue;
      const t = tokens[j];
      for (const bp of bpNorm) {
        if (tokenMatchesKw(t, bp)) return true;
        if (t.length >= 2 && prefixes.includes(t[0]) && tokenMatchesKw(t.slice(1), bp)) return true;
      }
    }
  }
  return false;
}

// ── Lethal-method gate (Commit 14) ────────────────────────────────────────────

/** Methods that establish lethal intent by their nature, suppressing the
 * homicide open-point card.  Specific forms only:
 *   Never bare "سم"  (اسم / سمّاه).
 *   Never bare "غرق" (accident — use أغرق/إغراق for intentional drowning).
 * @type {string[]} */
export const LETHAL_METHOD_KW = [
  // Strangulation — suffix matching covers خنقه خنقاً
  "خنق",
  // Poisoning
  "السم",          // "وضع السم في طعامه"
  "سماً",          // normalized: سما
  "سمّم",          // normalized: سمم
  "تسميم",
  "دسّ السم",      // two-token phrase
  "مادة سامة",    // toxic substance; also matches المادة السامة via article-strip
  // Burning — أحرق covers أحرقه; both word orders of "أشعل النار فيه"
  "أحرق",
  "أشعل النار فيه",
  "أشعل فيه النار",
  "سكب البنزين",
  // "البنزين" (bare fuel) removed — "تشاجرا في محطة البنزين فضربه بعصا" must not fire
  // Drowning — intentional forms only
  "أغرق",          // أغرقه via suffix
  "إغراق",
  // Slaughter
  "ذبح",           // ذبحه via suffix
  "نحر",           // نحره via suffix
];

/** Returns true when the facts describe a killing method that establishes
 * lethal intent by its nature (strangulation, poisoning, burning, drowning,
 * or slaughter) — used alongside factsMatchLethalWeapon to gate the homicide
 * open-point card.
 * @param {string} facts @returns {boolean} */
export function factsMatchLethalMethod(facts) {
  return factsMatchKeywords(facts, LETHAL_METHOD_KW);
}

// ── Stated-intent-to-kill gate (Commit 13/14) ────────────────────────────────

/** Phrases that signal the intent to kill is explicitly stated in the facts.
 *
 * NOT included: bare "قصد القتل" — it matches negated contexts such as
 * "نفى المتهم قصد القتل" and would falsely block the open-point gate.
 * @type {string[]} */
export const KILL_INTENT_KW = [
  // Direct purpose / intent phrases
  "بقصد قتله",
  "بقصد قتلها",
  "بقصد قتلهم",
  "قاصداً قتله",
  "قاصداً قتلها",
  "بنية قتله",
  "بنية قتلها",
  "أراد قتله",
  "أراد قتلها",
  "يريد قتله",
  "يريد قتلها",
  "نوى قتله",
  "نوى قتلها",
  // Premeditation (سبق الإصرار) and lying in wait
  "مع سبق الإصرار",
  "سبق الإصرار والترصد",
  "ترصد له",
  "تربص به",
  // Prior threat of death — exact phrases; proximity check handles indirect forms
  "توعده بالقتل",
  "هدده بالقتل",
];

/** Negators / denial verbs that cancel an intent phrase when they precede it
 * in the same clause.  Values are already normalised (ى→ي, أ→ا, tashkeel off)
 * so they can be compared directly against normalised token stream. */
const INTENT_NEGATORS_NORM = new Set([
  "لم", "لا", "ليس", "دون", "بدون", "بغير",
  "نفي",    // نفى → نفي after ى→ي
  "ينفي",
  "انكر",   // أنكر → انكر after أ→ا
  "ينكر",
]);

/** Returns true if the normalised token t (or its prefix-stripped form) is
 * a negator/denial verb.
 * @param {string} t @returns {boolean} */
function isNegatorToken(t) {
  if (INTENT_NEGATORS_NORM.has(t)) return true;
  if (t.length >= 2 && INTENT_NEGATORS_NORM.has(t.slice(1))) return true;
  return false;
}

/** Returns true when the facts text contains an explicit phrase indicating
 * the actor's stated intent to kill, with a negation guard:
 *   • For KILL_INTENT_KW phrases: match is discarded when any negator/denial
 *     verb precedes it within the 8 tokens before the phrase start.
 *   • For prior-threat (توعد/هدد ... بالقتل): also checks 8-token lookback.
 * @param {string} facts @returns {boolean} */
export function factsMatchIntentToKill(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // Returns true when no negator appears in the 8-token window before position i.
  function unNegated(i) {
    const start = Math.max(0, i - 8);
    for (let k = start; k < i; k++) {
      if (isNegatorToken(tokens[k])) return false;
    }
    return true;
  }

  // Check each KILL_INTENT_KW phrase (multi-token, contiguous).
  for (const kw of KILL_INTENT_KW) {
    const kwToks = normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
    if (kwToks.length === 0) continue;
    const n = kwToks.length;
    for (let i = 0; i <= tokens.length - n; i++) {
      if (kwToks.every((kt, j) => tokenMatchesKw(tokens[i + j], kt))) {
        if (unNegated(i)) return true;
      }
    }
  }

  // Proximity check: توعد/هدد within 7 tokens of بالقتل.
  // Handles "توعد المتهم المجني عليه بالقتل" where the object intervenes.
  const THREAT_NORMS = ["توعد", "هدد"];
  const KILL_TARGET = normalizeForKwMatch("بالقتل"); // "بالقتل"
  const SINGLE_PREFIXES = ["و", "ف", "ب", "ل", "ك"];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isThreaten = THREAT_NORMS.some(v =>
      tokenMatchesKw(t, v) ||
      (t.length >= 2 && SINGLE_PREFIXES.includes(t[0]) && tokenMatchesKw(t.slice(1), v))
    );
    if (!isThreaten) continue;
    if (!unNegated(i)) continue;
    for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 7); j++) {
      if (tokenMatchesKw(tokens[j], KILL_TARGET)) return true;
    }
  }

  return false;
}

/** Returns true when the facts text contains a word indicating that a physical
 * wound actually occurred.  Used alongside the LLM's discuss suggestion:
 * the card is shown only when BOTH the LLM proposes it AND this gate fires.
 *
 * Two-pass scan: the standard factsMatchKeywords pass (handles article/suffix),
 * then a second pass over prefix-stripped tokens (handles single-char prefix +
 * root + suffix combos like فجرحه / وشجّا / وكُسرت that tokenMatchesKw alone
 * does not reach, because the single-char-prefix rule requires an exact match
 * with no suffix).
 * @param {string} facts @returns {boolean} */
export function factsMatchWound(facts) {
  if (factsMatchKeywords(facts, WOUND_KW)) return true;
  // Second pass: strip one leading single-char prefix from each token and retry.
  // Handles forms like فجرحه / وشجّا that tokenMatchesKw alone can't reach
  // (single-char-prefix rule requires no suffix on the root).
  const norm = normalizeForKwMatch(facts);
  const tokens = norm.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const prefixes = ["و", "ف", "ب", "ل", "ك"];
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (!prefixes.includes(token[0])) continue;
    const stripped = token.slice(1);
    for (const kw of WOUND_KW) {
      const kwNorm = normalizeForKwMatch(kw);
      if (tokenMatchesKw(stripped, kwNorm)) return true;
    }
  }
  // كسر: bone-fracture only (not broken objects like قفل / باب).
  if (factsMatchBoneBreak(facts)) return true;
  return false;
}

// ── Deliberate-assault gate (Commit 18B) ─────────────────────────────────────

/** Acts that establish a deliberate attack on a person.
 * Used to override LLM قتل خطأ → قتل:وصف when the killing was the result of
 * an intentional assault rather than negligence.
 * "دفعه"/"دفعها" (pronoun forms only) are included; bare "دفع" (paid wages etc.)
 * is intentionally excluded.
 * @type {string[]} */
export const DELIBERATE_ASSAULT_KW = [
  "ضرب", "لكم", "ركل", "صفع",
  "طعن",    // stab — legal-appeal suppression NOT applied here
  "اعتدى",  // assault on person
  "هاجم",   // attack
  "خنق",    // strangle
  "دفعه",   // push (him/her) — pronoun suffix covers دفعها via tokenMatchesKw
  "رماه",   // threw at (him/her) — pronoun suffix covers رماها via tokenMatchesKw
];

/** Returns true when the facts describe a deliberate assault on a person
 * (ضرب / لكم / ركل / طعن / هاجم / خنق / دفعه / رماه / ...).
 * Called when the LLM returns قتل خطأ to check whether the killing
 * actually resulted from an intentional act.
 * @param {string} facts @returns {boolean} */
export function factsMatchDeliberateAssault(facts) {
  return factsMatchKeywords(facts, DELIBERATE_ASSAULT_KW);
}

// ── Lethal-method groups + whichLethalMethod (Commit 18C) ────────────────────

/** Maps each method label to the keywords that identify it.
 * Together these cover the same set as LETHAL_METHOD_KW.
 * @type {Record<string, string[]>} */
const LETHAL_METHOD_GROUPS = {
  "خنق":   ["خنق"],
  "سم":    ["السم", "سماً", "سمّم", "تسميم", "دسّ السم", "مادة سامة"],
  "حرق":   ["أحرق", "أشعل النار فيه", "أشعل فيه النار", "سكب البنزين"],
  "إغراق": ["أغرق", "إغراق"],
  "ذبح":   ["ذبح", "نحر"],
};

/** Returns the method label ("خنق" / "سم" / "حرق" / "إغراق" / "ذبح") when the
 * facts match a lethal method, or null when none matches.
 * @param {string} facts @returns {string|null} */
export function whichLethalMethod(facts) {
  for (const [method, keywords] of Object.entries(LETHAL_METHOD_GROUPS)) {
    if (factsMatchKeywords(facts, keywords)) return method;
  }
  return null;
}

// ── Lethal-weapon gate (with legal-appeal exclusion for طعن) ─────────────────

const LEGAL_STAB_CONTEXT = new Set(
  ["الحكم", "القرار", "الاستئناف", "النقض", "المحكمة"].map(normalizeForKwMatch)
);

/** True when a bare طعن/الطعن token appears within 3 tokens of a legal-appeal
 * term.  Verb forms with suffixes (طعنوه، طعنها) are NOT suppressed.
 * @param {string} facts @returns {boolean} */
function isTaunLegalAppeal(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t !== "طعن" && stripKwArticle(t) !== "طعن") continue;
    for (let j = i + 1; j <= i + 3 && j < tokens.length; j++) {
      if (LEGAL_STAB_CONTEXT.has(tokens[j])) return true;
    }
  }
  return false;
}

// ── Shooting proximity rule (Commit 18A) ─────────────────────────────────────

// Forms of أطلق (base + imperfect; suffix matching covers أطلقت/أطلقوا via tokenMatchesKw)
const ATLAQA_VERB_NORMS = ["اطلق", "يطلق"]; // normalized: أ→ا

// Base-form fire/projectile targets (tokenMatchesKw handles article/suffix on the text side)
// "نار" covers النار/ناراً; "عيار" covers عيار/عياراً;
// "اعيره" = أعيرة normalized (أ→ا, ة→ه); "رصاص" covers رصاصة/رصاصات;
// "طلقه" = طلقة normalized (ة→ه)
const FIRE_TARGET_NORMS = ["نار", "عيار", "اعيره", "رصاص", "طلقه"];

/** Returns true when a form of أطلق (أطلق، أطلقت، أطلقوا، يطلق) appears
 * within 6 tokens before a fire/projectile target (النار/عيار/رصاصة/...).
 * Handles intervening words like "أطلق المتهم النار" and "أطلق عليه المتهم ثلاث رصاصات".
 * FALSE for "أطلق سراح الرهينة" (no fire target) and "أطلقوا عليه لقب الزعيم" (no target).
 * @param {string} facts @returns {boolean} */
function factsMatchShootingProximity(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isVerb = ATLAQA_VERB_NORMS.some(v =>
      tokenMatchesKw(t, v) ||
      (t.length > 1 && SINGLE_CHAR_PREFIXES.includes(t[0]) && tokenMatchesKw(t.slice(1), v))
    );
    if (!isVerb) continue;
    for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 6); j++) {
      if (FIRE_TARGET_NORMS.some(n => tokenMatchesKw(tokens[j], n))) return true;
    }
  }
  return false;
}

// ── Narrator-level kill-intent negation (Changes 2 & 3) ─────────────────────

/** Normalised speech/denial verbs.  When one precedes the negation phrase
 * within 8 tokens, the negation belongs to the accused's statement, not to
 * the narrator's account — the gate must NOT fire in that case. */
const KILL_SPEECH_VERBS_NORM = [
  "نفي",    // نفى → نفي after ى→ي
  "ينفي",
  "انكر",   // أنكر → انكر after أ→ا
  "ينكر",
  "قال",
  "ادعي",   // ادعى → ادعي after ى→ي
  "زعم",
  "افاد",   // أفاد → افاد after أ→ا
  "ذكر",
  // Defence-plea verbs (Commit 22)
  "تمسك",
  "صرح",
  "اقر",    // أقر → اقر after أ→ا
  "اعترف",
];

/** Returns true when token is the bare "دفع" (argued/pleaded) WITHOUT a
 * pronoun suffix — i.e. not "دفعه" (pushed him) or "دفعها".
 * Handles article prefixes (الدفع) and single-char conjunctions (ودفع, فدفع).
 * @param {string} tok already-normalised token @returns {boolean} */
function isDafaSpeechVerb(tok) {
  const DAFA = "دفع";
  if (tok === DAFA) return true;
  if (stripKwArticle(tok) === DAFA) return true;
  for (const p of ["و", "ف", "ب", "ل", "ك"]) {
    if (tok === p + DAFA) return true;
  }
  return false;
}

/** Follow-up tokens (normalised) that confirm دفع is a speech/plea verb.
 * "بأنه" → "بانه", "بأن" → "بان", "محاميه" → "محاميه". */
const DAFA_FOLLOWS = new Set(["محاميه", "بانه", "بان"]);

/** Returns true when the facts state — at the NARRATOR level — that the actor
 * did NOT intend to kill (دون قصد قتله / ولم يكن يقصد قتله / بغير قصد القتل
 * and structurally similar phrases).
 *
 * Returns false when the negation is the accused's own statement, i.e. a
 * speech/denial verb (نفى / أنكر / قال / ادعى / زعم / أفاد / ذكر) appears in
 * the 8-token window before the negation phrase.
 *
 * Algorithm: for each negator token (دون / لم / بغير), scan forward up to 5
 * tokens for a kill-intent root (قصد / يقصد), then up to 3 more for a kill
 * target (قتله / قتلها / قتلهم / القتل).  Single-char prefixes are handled by
 * tokenMatchesKw so ولم matches لم and بقصد matches قصد.
 *
 * @param {string} facts @returns {boolean} */
export function factsNegateIntentToKill(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // B3: بلا/بدون added explicitly (also covered by single-char-prefix of لا/دون).
  const NEGATORS = ["دون", "لم", "بغير", "لا", "بلا", "بدون"];

  // B1: extended intent roots (all values already normalised: أ→ا, ة→ه, ى→ي).
  const INTENT_ROOTS = [
    "قصد", "يقصد",
    "يريد", "اراد", "يرد",
    "ينوي", "نوي", "ينو",
    "تعمد", "يتعمد",
    "قاصد", "ناوي", "متعمد",
    "نيه", "داير",
  ];

  // B2: roots starting with و (waw) — allow all prefixes including و/ف conjunctions
  // because و is part of the root, not a conjunction.
  const KILL_TARGETS_WAWROOT = ["وفاته", "وفاتها"];
  // B2: non-waw-root targets — reject tokens carrying و or ف conjunction prefix.
  const KILL_TARGETS_NONVERB = [
    "قتل", "قتله", "قتلها", "قتلهم", "القتل",
    "يقتله", "يقتلها", "يكتله", "يكتلو",
    "موته", "موتها", "ازهاق",
  ];

  // B3: ما counts as negator only when كان/قاصد/داير/ناوي follows within 2 tokens.
  const MA_FOLLOWS_SET = new Set(["كان", "قاصد", "داير", "ناوي"]);
  // B4: speaker-noun sets (normalised).
  const WITNESS_SPEAKERS = new Set(["الشاهد", "شاهد", "الشهود", "شهود", "الشاكي", "المبلغ"]);
  const ACCUSED_SPEAKERS = new Set(["المتهم", "الجاني", "محاميه", "الدفاع", "موكله"]);

  function isNegatorTok(t, pos) {
    if (NEGATORS.some(n => tokenMatchesKw(t, n))) return true;
    // B3: colloquial ما — strip one leading single-char prefix if present, then check.
    const bare = (t.length >= 2 && SINGLE_CHAR_PREFIXES.includes(t[0])) ? t.slice(1) : t;
    if (bare !== "ما") return false;
    for (let m = pos + 1; m <= Math.min(tokens.length - 1, pos + 2); m++) {
      if (MA_FOLLOWS_SET.has(tokens[m])) return true;
    }
    return false;
  }

  function isIntentTok(t) { return INTENT_ROOTS.some(v => tokenMatchesKw(t, v)); }

  function isKillTargetTok(t) {
    // Waw-root targets: their leading و is part of the root, allow all prefixes.
    if (KILL_TARGETS_WAWROOT.some(v => tokenMatchesKw(t, v))) return true;
    // Non-waw-root: reject tokens whose first char is و or ف (conjunction prefix).
    if (t.length >= 2 && (t[0] === "و" || t[0] === "ف")) return false;
    return KILL_TARGETS_NONVERB.some(v => tokenMatchesKw(t, v));
  }

  // B4: returns "witness", "accused", or "unknown" for the first speaker noun
  // found in tokens[startPos..endPos).
  function getFirstSpeakerRole(startPos, endPos) {
    for (let m = startPos; m < endPos; m++) {
      if (WITNESS_SPEAKERS.has(tokens[m])) return "witness";
      if (tokens[m] === "مقدم" && tokens[m + 1] === "البلاغ") return "witness";
      if (tokens[m] === "شاهد" && tokens[m + 1] === "عيان") return "witness";
      if (ACCUSED_SPEAKERS.has(tokens[m])) return "accused";
    }
    return "unknown";
  }

  function hasSpeechVerbBefore(pos) {
    const start = Math.max(0, pos - 8);
    for (let k = start; k < pos; k++) {
      // Single-token speech verbs (نفى / أنكر / قال / تمسك / صرح / أقر / اعترف …)
      if (KILL_SPEECH_VERBS_NORM.some(v => tokenMatchesKw(tokens[k], v))) {
        // B4: witness speaker within 4 tokens → this verb doesn't veto.
        const role = getFirstSpeakerRole(k + 1, Math.min(tokens.length, k + 5));
        if (role === "witness") continue;
        return true;
      }
      // "دفع بأنه" / "دفع محاميه بأن" — the bare verb دفع (pleaded) with no pronoun
      // suffix, followed within 3 tokens by a plea indicator. "دفعه" (pushed him)
      // does not pass isDafaSpeechVerb so it never triggers this veto.
      if (isDafaSpeechVerb(tokens[k])) {
        for (let m = k + 1; m < Math.min(tokens.length, k + 4); m++) {
          if (DAFA_FOLLOWS.has(tokens[m])) return true;
        }
      }
    }
    return false;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (!isNegatorTok(tokens[i], i)) continue;
    for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 5); j++) {
      if (!isIntentTok(tokens[j])) continue;
      for (let k = j + 1; k <= Math.min(tokens.length - 1, j + 3); k++) {
        if (!isKillTargetTok(tokens[k])) continue;
        if (!hasSpeechVerbBefore(i)) return true;
      }
    }
  }
  return false;
}

/** Use this instead of factsMatchKeywords(facts, LETHAL_WEAPON_KW).
 * Also fires when أطلق + fire target appear within 6 tokens (proximity rule),
 * which handles "أطلق المتهم النار" where the phrase is non-adjacent.
 * For bare طعن/الطعن: suppressed when it is a legal-appeal context.
 * @param {string} facts @returns {boolean} */
export function factsMatchLethalWeapon(facts) {
  if (factsMatchShootingProximity(facts)) return true;
  if (!factsMatchKeywords(facts, LETHAL_WEAPON_KW)) return false;
  // Check if any keyword other than bare "طعن" (verb) already fires.
  const withoutVerb = LETHAL_WEAPON_KW.filter(k => normalizeForKwMatch(k) !== "طعن");
  if (factsMatchKeywords(facts, withoutVerb)) return true;
  // Only طعن fired — suppress if it is a legal-appeal context.
  return !isTaunLegalAppeal(facts);
}
