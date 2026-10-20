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
  // و/ف prefix + keyword + closed suffix (وخنقه, فذبحه, وأغرقه …)
  if (textToken.length > 1 && (textToken[0] === "و" || textToken[0] === "ف")) {
    const wfRest = textToken.slice(1);
    if (wfRest.startsWith(kwToken) && wfRest.length > kwToken.length) {
      if (isSuffix(wfRest.slice(kwToken.length))) return true;
    }
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
  "يد", "ذراع", "ساعد", "رجل", "ساق", "فخذ", "كتف",
  "عظم", "عظام",
  "أنف", "فك", "جمجمة", "صدر", "ضلع",
  "كوع", "ركبة", "رقبة", "قدم", "إصبع",
  "رأس", "حلق",
];

/** Returns true when "كسر" or the Form-VII passive "انكسر" (in any inflected
 * form) appears in the facts AND a body-part word is within ±4 tokens of it.
 * This avoids false fires on "كسر قفل المتجر" or "كسر باب المخزن".
 * The two-pass prefix-strip (covering فكسر / وكُسرت / وانكسرت) matches the
 * logic in factsMatchWound so both passes find the break-verb token position.
 * Exported so analyze.ts can distinguish bone-fracture from hot-liquid paths.
 * @param {string} facts @returns {boolean} */
export function factsMatchBoneBreak(facts) {
  const norm = normalizeForKwMatch(facts);
  const tokens = norm.split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const prefixes = ["و", "ف", "ب", "ل", "ك"];
  const bpNorm = BODY_PART_KW.map(normalizeForKwMatch);
  const BREAK_NORMS = ["كسر", "انكسر"].map(normalizeForKwMatch);

  // Find all positions where a break-verb token appears (with or without prefix).
  function isBreak(t) {
    if (BREAK_NORMS.some(ksr => tokenMatchesKw(t, ksr))) return true;
    if (t.length >= 2 && prefixes.includes(t[0])) {
      const s = t.slice(1);
      if (BREAK_NORMS.some(ksr => tokenMatchesKw(s, ksr))) return true;
    }
    return false;
  }
  const positions = [];
  for (let i = 0; i < tokens.length; i++) {
    if (isBreak(tokens[i])) positions.push(i);
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
  if (factsMatchKeywords(facts, LETHAL_METHOD_KW)) return true;
  if (factsMatchPoisonProximity(facts)) return true;
  if (factsMatchBurning(facts) === "strong") return true;
  if (factsMatchDrowning(facts) === "strong") return true;
  return false;
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

/** Returns true when the facts describe a deliberate assault on a person.
 * Called when the LLM returns قتل خطأ to check whether the killing
 * actually resulted from an intentional act.
 *
 * طعن / اعتدى / هاجم / خنق / دفعه / رماه — unchanged bare keyword match.
 * ضرب / لكم / ركل / صفع — tightened: the verb token fires only when one of
 *   (a) carries an object pronoun ه/ها/هم/هن/ني/ك AND next token is not a
 *       non-person natural-force/vehicle word; taa-marbuta tokens (وركلة) skipped.
 *   (b) a person word appears in the next 4 tokens.
 *   (c) an instrument or BODY_PART_KW word appears in the next 3 tokens.
 *   (d) a verbal-noun form (ضرباً/لكمات/ركلات/صفعة/صفعات) has an
 *       object-pronoun-bearing token or person word within ±3.
 * @param {string} facts @returns {boolean} */
export function factsMatchDeliberateAssault(facts) {
  // Unchanged verbs — simple keyword scan
  if (factsMatchKeywords(facts, ["طعن", "اعتدى", "هاجم", "خنق", "دفعه", "رماه"])) return true;

  // ── constants ────────────────────────────────────────────────────────────────
  const OBJ_PRONOUNS = ["ها", "هم", "هن", "ني", "ك", "ه"]; // longest first
  const FOUR_VERB_NORMS = ["ضرب", "لكم", "ركل", "صفع"].map(normalizeForKwMatch);

  // Natural forces / vehicles / abstracts that appear as subjects after verb forms
  const NON_PERSON_NORM = new Set([
    "المطر", "الريح", "البرد", "الحر", "الكهرباء", "التيار",
    "الزلزال", "الموج", "الموجه", "السياره", "العربيه", "الباب",
  ].map(normalizeForKwMatch));

  // Person words for condition (b)
  const PERSON_NORMS = [
    "المجني", "الضحيه", "الشاكي", "الطفل", "المراه", "الرجل",
    "زوجته", "زوجها", "جاره", "اخاه", "اخيه", "ابنه", "ابنته",
  ].map(normalizeForKwMatch);

  // Instruments for condition (c)
  const INSTRUMENT_NORMS = [
    "بعصا", "بالعصا", "بسكين", "بالسكين", "بحجر", "بالحجر",
    "بالسفروق", "بالجنزير", "بالبوكس",
    "بيده", "بيديه", "بقبضته", "برجله", "بالحزام", "بالسوط",
  ].map(normalizeForKwMatch);

  // Verbal-noun forms for condition (d)
  // ضرباً→ضربا, لكمات, ركلات, صفعة→صفعه, صفعات
  const VERBAL_NOUN_NORMS = ["ضربا", "لكمات", "ركلات", "صفعه", "صفعات"].map(normalizeForKwMatch);

  const bodyNorms = BODY_PART_KW.map(normalizeForKwMatch);

  // ── parallel original / normalized token arrays ───────────────────────────
  // Counts are equal: tashkeel removal and ة/ى/أ substitutions all stay within
  // the Arabic Unicode range and do not change token boundaries.
  const punct = /[،؛؟.]/g;
  const origTokens = facts.replace(punct, " ").split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const normTokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // ── helpers ──────────────────────────────────────────────────────────────────

  /** True when normTok (which matches verbNorm) carries one of the object
   * pronouns ه/ها/هم/هن/ني/ك as a suffix (possibly after a verb ending وا/ت…).
   * origTok must NOT end in ة (taa marbuta) — that indicates a noun form. */
  function hasObjPronounSuffix(normTok, verbNorm, origTok) {
    if (origTok.endsWith("ة")) return false; // noun form (وركلة, صفعة …)
    function checkRest(rest) {
      for (const p of OBJ_PRONOUNS) {
        if (rest === p) return true;
      }
      for (const ve of ["وا", "ت", "و", "ا", "ن"]) {
        if (rest.startsWith(ve)) {
          const after = rest.slice(ve.length);
          if (OBJ_PRONOUNS.some(p => p === after)) return true;
        }
      }
      return false;
    }
    // Direct: normTok = verbNorm + rest
    if (normTok.startsWith(verbNorm) && normTok.length > verbNorm.length) {
      if (checkRest(normTok.slice(verbNorm.length))) return true;
    }
    // Article-stripped
    const art = stripKwArticle(normTok);
    if (art !== normTok && art.startsWith(verbNorm) && art.length > verbNorm.length) {
      if (checkRest(art.slice(verbNorm.length))) return true;
    }
    // و/ف prefix (rule 6 analogue)
    if (normTok.length > 1 && (normTok[0] === "و" || normTok[0] === "ف")) {
      const wfRest = normTok.slice(1);
      if (wfRest.startsWith(verbNorm) && wfRest.length > verbNorm.length) {
        if (checkRest(wfRest.slice(verbNorm.length))) return true;
      }
    }
    return false;
  }

  /** True when normTok is an instrument or a BODY_PART_KW word (with suffixes). */
  function isInstrumentOrBodyPart(normTok) {
    if (INSTRUMENT_NORMS.some(v => tokenMatchesKw(normTok, v))) return true;
    if (bodyNorms.some(v => tokenMatchesKw(normTok, v))) return true;
    return false;
  }

  /** For condition (d): true when normTok ends in an OBJ_PRONOUN (and the
   * original token did not end in ة), or is a person word. */
  function hasPronounOrIsPerson(normTok, origTok) {
    if (PERSON_NORMS.some(v => tokenMatchesKw(normTok, v))) return true;
    if (origTok.endsWith("ة")) return false;
    for (const p of OBJ_PRONOUNS) {
      if (normTok.endsWith(p)) return true;
    }
    return false;
  }

  // ── main scan (conditions a / b / c) ──────────────────────────────────────
  for (let i = 0; i < normTokens.length; i++) {
    const normTok = normTokens[i];
    const origTok = origTokens[i] ?? "";

    let matchedVerb = null;
    for (const v of FOUR_VERB_NORMS) {
      if (tokenMatchesKw(normTok, v)) { matchedVerb = v; break; }
    }
    if (!matchedVerb) continue;

    // (a) object pronoun on the verb token + next is not a non-person subject
    if (hasObjPronounSuffix(normTok, matchedVerb, origTok)) {
      const next = normTokens[i + 1];
      if (!next || !NON_PERSON_NORM.has(next)) return true;
    }

    // (b) person word in next 4 tokens
    for (let j = i + 1; j <= Math.min(normTokens.length - 1, i + 4); j++) {
      if (PERSON_NORMS.some(v => tokenMatchesKw(normTokens[j], v))) return true;
    }

    // (c) instrument or body-part in next 3 tokens
    for (let j = i + 1; j <= Math.min(normTokens.length - 1, i + 3); j++) {
      if (isInstrumentOrBodyPart(normTokens[j])) return true;
    }
  }

  // ── condition (d): verbal noun + pronoun-bearing / person token within ±3 ──
  for (let i = 0; i < normTokens.length; i++) {
    if (!VERBAL_NOUN_NORMS.some(v => tokenMatchesKw(normTokens[i], v))) continue;
    for (let j = Math.max(0, i - 3); j <= Math.min(normTokens.length - 1, i + 3); j++) {
      if (j === i) continue;
      if (hasPronounOrIsPerson(normTokens[j], origTokens[j] ?? "")) return true;
    }
  }

  return false;
}

// ── Lethal-method groups + whichLethalMethod (Commit 18C) ────────────────────

/** Maps each method label to the keywords that identify it.
 * Together these cover the same set as LETHAL_METHOD_KW.
 * @type {Record<string, string[]>} */
const LETHAL_METHOD_GROUPS = {
  "خنق":   ["خنق"],
  "سم":    ["السم", "سمّم", "تسميم", "دسّ السم", "مادة سامة"],
  "حرق":   ["أحرق", "أشعل النار فيه", "أشعل فيه النار", "سكب البنزين"],
  "إغراق": ["أغرق", "إغراق"],
  "ذبح":   ["ذبح", "نحر"],
};

// ── Poison proximity rule ─────────────────────────────────────────────────────

const POISON_EXACT_NORMS = new Set(
  ["سم", "سموم", "سام", "سامة", "مسموم", "مسمومة", "سماً", "ساماً", "مسموماً"].map(normalizeForKwMatch)
);
const POISON_MADDA_NORM = normalizeForKwMatch("مادة");
const POISON_DARR_NORM  = normalizeForKwMatch("ضارة");
const POISON_MUBID_NORM = normalizeForKwMatch("مبيد");

const FOOD_DRINK_BASE_NORMS = [
  "طعام", "أكل", "شراب", "مشروب", "عصير", "شاي", "قهوة",
  "لبن", "حليب", "كوب", "كأس", "وجبة", "ملاح",
  "سقاه", "أطعمه",
].map(normalizeForKwMatch);

/** Returns true when a poison word (سم/سموم/سام/سامة/مسموم/مسمومة/مبيد/مادة ضارة)
 * appears within 6 tokens of a food or drink word, in either order.
 * Guards: bare سم is excluded when the previous token is a digit (centimetres).
 * @param {string} facts @returns {boolean} */
function factsMatchPoisonProximity(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const poisonPos = [];
  const foodPos = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const bare = stripKwArticle(t);

    // Two-token phrase: مادة ضارة
    if (i + 1 < tokens.length &&
        tokenMatchesKw(t, POISON_MADDA_NORM) &&
        tokenMatchesKw(tokens[i + 1], POISON_DARR_NORM)) {
      poisonPos.push(i);
      continue;
    }
    // مبيد: normal suffix + article matching
    if (tokenMatchesKw(t, POISON_MUBID_NORM)) {
      poisonPos.push(i);
      continue;
    }
    // Exact poison words — exact token or article-stripped only (no suffix)
    // "بسم" is naturally excluded: stripKwArticle("بسم") = "بسم" (ب not in KW_ARTICLE_PREFIXES)
    if (POISON_EXACT_NORMS.has(t) || POISON_EXACT_NORMS.has(bare)) {
      // Bare سم: skip when preceded by a digit (e.g. "3 سم" = centimetres)
      if ((t === "سم" || bare === "سم") &&
          i > 0 && /^[0-9٠-٩]/.test(tokens[i - 1])) continue;
      poisonPos.push(i);
      continue;
    }
    // Food/drink words
    if (FOOD_DRINK_BASE_NORMS.some(kw => tokenMatchesKw(t, kw))) {
      foodPos.push(i);
    }
  }

  for (const pp of poisonPos) {
    for (const fp of foodPos) {
      if (Math.abs(pp - fp) <= 6) return true;
    }
  }
  return false;
}

// ── Burning proximity rule ────────────────────────────────────────────────────

const IGNITE_VERB_NORMS    = ["أضرم", "أشعل", "ولّع"].map(normalizeForKwMatch);
const BURN_PERSON_TGT_NORMS = [
  "فيه", "فيها", "فيهم",
  "ملابسه", "ملابسها", "هدومه", "هدومها",
  "جسده", "جسدها", "جسمه", "جسمها",
  "المجني",
].map(normalizeForKwMatch);
const IHRAAQ_NORM      = normalizeForKwMatch("إحراق");
const MAJNI_NORM       = normalizeForKwMatch("المجني");
const POUR_VERB_NORMS  = ["سكب", "صب", "كب", "رش"].map(normalizeForKwMatch);
const POUR_PERSON_NORMS = ["عليه", "عليها"].map(normalizeForKwMatch);
const FUEL_NOUN_NORMS  = ["بنزين", "جاز", "جازولين", "كيروسين"].map(normalizeForKwMatch);
const QABILA_NORM      = normalizeForKwMatch("قابلة");
const HARQ_NORM        = normalizeForKwMatch("حرق");
const _BURN_SINGLE     = ["و", "ف", "ب", "ل", "ك"];
const NNAR_NORM        = normalizeForKwMatch("النار");
const BURN_FI_NORMS    = ["فيه", "فيها", "فيهم"].map(normalizeForKwMatch);
const BURN_BODY_NORMS  = [
  "ملابسه", "ملابسها", "هدومه", "هدومها",
  "جسده", "جسدها", "جسمه", "جسمها",
].map(normalizeForKwMatch);
const FI_PREP_NORM     = normalizeForKwMatch("في");

/** Returns "strong", "weak", or null for burning.
 *  STRONG: ignite verb near person target; حرقه/حرقها/حرقهم; إحراق near المجني;
 *          or WEAK pour pattern followed by ignite verb within 6 tokens.
 *  WEAK:   pour verb + عليه/عليها within 2 + fuel noun within 5.
 * @param {string} facts @returns {"strong"|"weak"|null} */
function factsMatchBurning(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  function isIgnite(t) {
    if (IGNITE_VERB_NORMS.some(v => tokenMatchesKw(t, v))) return true;
    if (t.length >= 2 && _BURN_SINGLE.includes(t[0]) &&
        IGNITE_VERB_NORMS.some(v => tokenMatchesKw(t.slice(1), v))) return true;
    return false;
  }
  function isPersonTgt(t) {
    if (BURN_PERSON_TGT_NORMS.some(v => tokenMatchesKw(t, v))) return true;
    if (t.length >= 2 && _BURN_SINGLE.includes(t[0]) &&
        BURN_PERSON_TGT_NORMS.some(v => tokenMatchesKw(t.slice(1), v))) return true;
    return false;
  }
  function isBurnPronoun(t) {
    const candidates = [t, stripKwArticle(t)];
    if (t.length > 1 && (t[0] === "و" || t[0] === "ف")) candidates.push(t.slice(1));
    for (const cand of candidates) {
      if (cand.startsWith(HARQ_NORM) && cand.length > HARQ_NORM.length) {
        const suf = cand.slice(HARQ_NORM.length);
        if (suf === "ه" || suf === "ها" || suf === "هم") return true;
      }
    }
    return false;
  }
  function isPour(t) {
    if (POUR_VERB_NORMS.some(v => tokenMatchesKw(t, v))) return true;
    if (t.length >= 2 && _BURN_SINGLE.includes(t[0]) &&
        POUR_VERB_NORMS.some(v => tokenMatchesKw(t.slice(1), v))) return true;
    return false;
  }
  function fuelAt(j) {
    const t = tokens[j];
    if (FUEL_NOUN_NORMS.some(v => tokenMatchesKw(t, v) || tokenMatchesKw(stripKwArticle(t), v))) return true;
    if (j + 1 < tokens.length && tokenMatchesKw(t, POISON_MADDA_NORM) &&
        tokenMatchesKw(tokens[j + 1], QABILA_NORM)) return true;
    return false;
  }

  let weakFound = false;
  let weakPourPos = -1;

  for (let i = 0; i < tokens.length; i++) {
    // STRONG: حرقه / حرقها / حرقهم
    if (isBurnPronoun(tokens[i])) return "strong";

    // STRONG: إحراق within 2 tokens of المجني
    if (tokenMatchesKw(tokens[i], IHRAAQ_NORM) || tokenMatchesKw(stripKwArticle(tokens[i]), IHRAAQ_NORM)) {
      for (let j = Math.max(0, i - 2); j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (j !== i && tokenMatchesKw(tokens[j], MAJNI_NORM)) return "strong";
      }
    }

    // STRONG: ignite verb → (optional النار) → IMMEDIATELY فيه/فيها/فيهم
    //         or IMMEDIATELY «في» + clothes/body/المجني
    if (isIgnite(tokens[i])) {
      let p = i + 1;
      if (p < tokens.length && tokenMatchesKw(tokens[p], NNAR_NORM)) p++;
      if (p < tokens.length) {
        if (BURN_FI_NORMS.some(v => tokenMatchesKw(tokens[p], v))) return "strong";
        if (tokenMatchesKw(tokens[p], FI_PREP_NORM) && p + 1 < tokens.length) {
          const nxt = tokens[p + 1];
          if (BURN_BODY_NORMS.some(v => tokenMatchesKw(nxt, v)) ||
              tokenMatchesKw(nxt, MAJNI_NORM)) return "strong";
        }
      }
    }

    // WEAK: pour verb + عليه/عليها within 2 + fuel within 5
    if (isPour(tokens[i])) {
      let hasPerson = false;
      for (let j = Math.max(0, i - 2); j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (j !== i && POUR_PERSON_NORMS.some(v => tokenMatchesKw(tokens[j], v))) { hasPerson = true; break; }
      }
      if (!hasPerson) continue;
      let hasFuel = false;
      for (let j = Math.max(0, i - 5); j <= Math.min(tokens.length - 1, i + 5); j++) {
        if (fuelAt(j)) { hasFuel = true; break; }
      }
      if (!hasFuel) continue;
      weakFound = true;
      weakPourPos = i;
    }
  }

  // STRONG from WEAK + ignite within 6 tokens of pour verb
  if (weakFound) {
    for (let j = Math.max(0, weakPourPos - 6); j <= Math.min(tokens.length - 1, weakPourPos + 6); j++) {
      if (isIgnite(tokens[j])) return "strong";
    }
    return "weak";
  }

  return null;
}

// ── Drowning proximity rule ─────────────────────────────────────────────────

const DROWN_GHATAS_NORM  = normalizeForKwMatch("غطس");
const DROWN_GHAMARA_NORM = normalizeForKwMatch("غمر");
const DROWN_GHARIQA_NORM = normalizeForKwMatch("غرق");
const DROWN_MGHM_NORM    = normalizeForKwMatch("مغمور");
const DROWN_HEAD_NORM    = normalizeForKwMatch("رأسه");   // راسه
const DROWN_HOLD_NORMS   = ["مسك", "أمسك"].map(normalizeForKwMatch);
const DROWN_DIR_NORMS    = ["تحت", "جوة", "داخل"].map(normalizeForKwMatch);
const DROWN_EXIT_NORMS   = ["الخروج", "يخرج", "يطلع"].map(normalizeForKwMatch);
const DROWN_MANAAH_NORM  = normalizeForKwMatch("منعه");
const DROWN_MA_NORM      = normalizeForKwMatch("ما");
const DROWN_KHALAAH_NORM = normalizeForKwMatch("خلاه");
const WATER_WORD_NORMS   = ["الماء", "ماء", "المياه", "الموية", "موية"].map(normalizeForKwMatch);
const WATER_BODY_NORMS   = [
  "النهر", "النيل", "البحر", "الترعة", "الخور",
  "الحفير", "البئر", "البركة", "الماء", "الموية",
].map(normalizeForKwMatch);
const WEAK_DROWN_VERB_NORMS  = ["دفعه", "كباه", "كبه", "رماه", "ألقاه"].map(normalizeForKwMatch);
const DROWN_ANCHOR_NORMS     = ["أبقاه", "أبقاها", "تركه", "تركها"].map(normalizeForKwMatch);
const WEAK_DROWN_PREP_NORMS  = ["في", "إلى", "داخل", "جوة"].map(normalizeForKwMatch);
const DROWN_MIN_NORM         = normalizeForKwMatch("من");

/** Returns "strong"/"weak"/null.
 * STRONG 1/3: غطس/غرق + pronoun ه/ها/هم only; STRONG 2: غطس/غمر within 2 of رأسه;
 *   STRONG 4: anchor (أبقاه/تركه) within 2 before مغمور + water within 2 after;
 *   STRONG 5: hold verb → direction (next 5) → water IMMEDIATELY after direction;
 *   STRONG 6: prevent form → exit (next 4) → «من» → water IMMEDIATELY.
 * WEAK: push verb → prep (في/إلى/داخل/جوة) within next 3 → water body IMMEDIATELY.
 * Bare غرق and نا/ك/هن pronouns never match.
 * @param {string} facts @returns {"strong"|"weak"|null} */
function factsMatchDrowning(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  function isWaterWord(t) { return WATER_WORD_NORMS.some(v => tokenMatchesKw(t, v)); }
  function isWaterBody(t) { return WATER_BODY_NORMS.some(v => tokenMatchesKw(t, v)); }
  function isDrownPronoun(t, base) {
    const candidates = [t, stripKwArticle(t)];
    if (t.length > 1 && (t[0] === "و" || t[0] === "ف")) candidates.push(t.slice(1));
    for (const cand of candidates) {
      if (cand.startsWith(base) && cand.length > base.length) {
        const suf = cand.slice(base.length);
        if (suf === "ه" || suf === "ها" || suf === "هم") return true;
      }
    }
    return false;
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // STRONG 1: غطّسه/غطّسها/غطّسهم — غطس + pronoun ه/ها/هم only
    if (isDrownPronoun(t, DROWN_GHATAS_NORM)) return "strong";

    // STRONG 2: غطس or غمر within 2 tokens of رأسه/راسه (bidirectional)
    if (tokenMatchesKw(t, DROWN_GHATAS_NORM) || tokenMatchesKw(t, DROWN_GHAMARA_NORM)) {
      for (let j = Math.max(0, i - 2); j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (j !== i && tokenMatchesKw(tokens[j], DROWN_HEAD_NORM)) return "strong";
      }
    }

    // STRONG 3: غرقه/غرقها/غرقهم — غرق + pronoun ه/ها/هم only (bare غرق never fires)
    if (isDrownPronoun(t, DROWN_GHARIQA_NORM)) return "strong";

    // STRONG 4: anchor (أبقاه/أبقاها/تركه/تركها) within 2 before مغمور,
    //           water word within 2 after مغمور
    if (tokenMatchesKw(t, DROWN_MGHM_NORM)) {
      let hasAnchor = false;
      for (let j = Math.max(0, i - 2); j < i && !hasAnchor; j++) {
        if (DROWN_ANCHOR_NORMS.some(v => tokenMatchesKw(tokens[j], v))) hasAnchor = true;
      }
      if (hasAnchor) {
        for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
          if (isWaterWord(tokens[j])) return "strong";
        }
      }
    }

    // STRONG 5: hold verb → direction word within next 5 → water IMMEDIATELY after direction
    if (DROWN_HOLD_NORMS.some(v => tokenMatchesKw(t, v))) {
      for (let d = i + 1; d <= Math.min(tokens.length - 1, i + 5); d++) {
        if (!DROWN_DIR_NORMS.some(v => tokenMatchesKw(tokens[d], v))) continue;
        if (d + 1 < tokens.length && isWaterWord(tokens[d + 1])) return "strong";
      }
    }

    // STRONG 6a: منعه → exit word within next 4 → «من» IMMEDIATELY → water IMMEDIATELY
    if (tokenMatchesKw(t, DROWN_MANAAH_NORM)) {
      for (let e = i + 1; e <= Math.min(tokens.length - 1, i + 4); e++) {
        if (!DROWN_EXIT_NORMS.some(v => tokenMatchesKw(tokens[e], v))) continue;
        if (e + 2 < tokens.length &&
            tokenMatchesKw(tokens[e + 1], DROWN_MIN_NORM) &&
            isWaterWord(tokens[e + 2])) return "strong";
      }
    }

    // STRONG 6b: «ما خلاه» → exit word within next 4 → «من» IMMEDIATELY → water IMMEDIATELY
    if (i + 1 < tokens.length &&
        tokenMatchesKw(t, DROWN_MA_NORM) &&
        tokenMatchesKw(tokens[i + 1], DROWN_KHALAAH_NORM)) {
      for (let e = i + 1; e <= Math.min(tokens.length - 1, i + 4); e++) {
        if (!DROWN_EXIT_NORMS.some(v => tokenMatchesKw(tokens[e], v))) continue;
        if (e + 2 < tokens.length &&
            tokenMatchesKw(tokens[e + 1], DROWN_MIN_NORM) &&
            isWaterWord(tokens[e + 2])) return "strong";
      }
    }
  }

  // WEAK: push verb → prep (في/إلى/داخل/جوة) within next 3 → water body IMMEDIATELY after prep
  for (let i = 0; i < tokens.length; i++) {
    if (!WEAK_DROWN_VERB_NORMS.some(v => tokenMatchesKw(tokens[i], v))) continue;
    for (let p = i + 1; p <= Math.min(tokens.length - 1, i + 3); p++) {
      if (!WEAK_DROWN_PREP_NORMS.some(v => tokenMatchesKw(tokens[p], v))) continue;
      if (p + 1 < tokens.length && isWaterBody(tokens[p + 1])) return "weak";
    }
  }

  return null;
}

/** Returns the method label ("خنق" / "سم" / "حرق" / "إغراق" / "ذبح") when the
 * facts match a lethal method, or null when none matches.
 * @param {string} facts @returns {string|null} */
export function whichLethalMethod(facts) {
  for (const [method, keywords] of Object.entries(LETHAL_METHOD_GROUPS)) {
    if (factsMatchKeywords(facts, keywords)) return method;
  }
  if (factsMatchPoisonProximity(facts)) return "سم";
  const burn = factsMatchBurning(facts);
  if (burn !== null) return "حرق";
  const drown = factsMatchDrowning(facts);
  if (drown !== null) return "إغراق";
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

// ── Serious-injury detectors (Commit 33) ─────────────────────────────────────

// Extended pour verbs: standard set + دفق + رمى + أدخل (insert into)
const SJ_POUR_VERB_NORMS = ["سكب", "صب", "كب", "رش", "دفق", "رمى", "أدخل"].map(normalizeForKwMatch);

// Person-target indicators for hot/caustic liquid detection.
// Includes عليه/عليها, the preposition على, body-part direct objects, and person nouns.
const SJ_POUR_PERSON_NORMS = [
  "عليه", "عليها", "على",
  "شخص", "إنسان", "امرأة",
  "وجه", "وجهه", "وجهها",
  "عين", "عينه", "عينها",
  "رأسه", "راسه",
  "أنف", "أنفه",
  "فم", "فمه",
  "حلق",
  "أذن",
  "جسمه", "جسمها", "جسده", "جسدها",
  "يده", "يدها",
  "رجله", "رجلها",
  "المجني",
].map(normalizeForKwMatch);

// Hot liquids — two-token contiguous pairs [first, second]; both matched via tokenMatchesKw
const HOT_LIQUID_PAIRS = [
  ["ماء", "مغلي"],
  ["موية", "مغلية"],
  ["موية", "حارة"],
  ["موية", "سخنة"],
  ["ماء", "ساخن"],
  ["زيت", "مغلي"],
  ["زيت", "حار"],
  ["شاي", "حار"],
].map(pair => pair.map(normalizeForKwMatch));

// Caustic liquids — two-token phrases + single tokens
const CAUSTIC_LIQUID_PAIRS = [
  ["موية", "نار"],
  ["ماء", "النار"],
  ["مادة", "كاوية"],
  ["مادة", "حارقة"],
].map(pair => pair.map(normalizeForKwMatch));

const CAUSTIC_SINGLE_NORMS = ["حامض", "أسيد"].map(normalizeForKwMatch);

// Dangerous-site target words (face, eyes, head, nose, mouth, throat, ear)
const DANGER_SITE_NORMS = [
  "وجه", "وجهه", "وجهها",
  "عين", "عينه", "عينها",
  "رأس", "رأسه", "راسه",
  "أنف", "أنفه",
  "فم", "فمه",
  "حلق",
  "أذن",
].map(normalizeForKwMatch);

/** Internal helper: returns { tokens, liquidPos } when a pour verb + person target
 * + hot/caustic liquid pattern is detected; null otherwise.
 * @param {string} facts @returns {{tokens:string[],liquidPos:number}|null} */
function _hotLiquidPourResult(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const SFX = ["و", "ف", "ب", "ل", "ك"];

  function isPourVerb(t) {
    if (SJ_POUR_VERB_NORMS.some(v => tokenMatchesKw(t, v))) return true;
    if (t.length >= 2 && SFX.includes(t[0]) &&
        SJ_POUR_VERB_NORMS.some(v => tokenMatchesKw(t.slice(1), v))) return true;
    return false;
  }

  function isPersonTarget(t) {
    if (SJ_POUR_PERSON_NORMS.some(v => tokenMatchesKw(t, v))) return true;
    if (t.length >= 2 && SFX.includes(t[0]) &&
        SJ_POUR_PERSON_NORMS.some(v => tokenMatchesKw(t.slice(1), v))) return true;
    return false;
  }

  // Check hot/caustic liquid starting at position j; return true + update externally
  function liquidAt(j) {
    if (CAUSTIC_SINGLE_NORMS.some(v => tokenMatchesKw(tokens[j], v))) return true;
    if (j + 1 < tokens.length) {
      for (const [a, b] of HOT_LIQUID_PAIRS) {
        if (tokenMatchesKw(tokens[j], a) && tokenMatchesKw(tokens[j + 1], b)) return true;
      }
      for (const [a, b] of CAUSTIC_LIQUID_PAIRS) {
        if (tokenMatchesKw(tokens[j], a) && tokenMatchesKw(tokens[j + 1], b)) return true;
      }
      // Also strip article prefix on first token (handles «بمادة كاوية»)
      const stripped = stripKwArticle(tokens[j]);
      if (stripped !== tokens[j]) {
        for (const [a, b] of HOT_LIQUID_PAIRS) {
          if (tokenMatchesKw(stripped, a) && tokenMatchesKw(tokens[j + 1], b)) return true;
        }
        for (const [a, b] of CAUSTIC_LIQUID_PAIRS) {
          if (tokenMatchesKw(stripped, a) && tokenMatchesKw(tokens[j + 1], b)) return true;
        }
      }
      // Handle single-char prefix on first token (e.g. بمادة → ب + مادة)
      if (tokens[j].length >= 2 && SFX.includes(tokens[j][0])) {
        const rest = tokens[j].slice(1);
        for (const [a, b] of HOT_LIQUID_PAIRS) {
          if (tokenMatchesKw(rest, a) && tokenMatchesKw(tokens[j + 1], b)) return true;
        }
        for (const [a, b] of CAUSTIC_LIQUID_PAIRS) {
          if (tokenMatchesKw(rest, a) && tokenMatchesKw(tokens[j + 1], b)) return true;
        }
      }
    }
    return false;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (!isPourVerb(tokens[i])) continue;

    // Check person target within ±5
    let hasPerson = false;
    for (let j = Math.max(0, i - 5); j <= Math.min(tokens.length - 1, i + 5) && !hasPerson; j++) {
      if (j !== i && isPersonTarget(tokens[j])) hasPerson = true;
    }
    if (!hasPerson) continue;

    // Check hot/caustic liquid within ±5
    for (let j = Math.max(0, i - 5); j <= Math.min(tokens.length - 1, i + 5); j++) {
      if (liquidAt(j)) return { tokens, liquidPos: j };
    }
  }
  return null;
}

/** Returns true when the facts describe a hot or caustic liquid poured on a person.
 * Extracted from factsMatchSeriousInjury so callers can treat it as a
 * deliberate act independently of bone-fracture detection.
 * @param {string} facts @returns {boolean} */
export function factsMatchHotLiquidPour(facts) {
  return _hotLiquidPourResult(facts) !== null;
}

// ── Commit 36: abstain fallback detectors ────────────────────────────────────

/** Returns true when the facts describe a death (past tense / noun forms).
 * Guard 1: negation (لم/ما/لا/ولم/وما/ولا) within 2 tokens before the death token.
 * Guard 2: non-person subject (بطارية/موبايل/سيارة/زرع) within ±3 tokens.
 * @param {string} facts @returns {boolean} */
export function factsMatchDeath(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const DEATH_KW_NORMS = [
    "مات", "ماتت", "توفي", "توفى", "توفيت",
    "وفاة", "وفاته", "وفاتها", "مقتل", "جثة", "جثته",
  ].map(normalizeForKwMatch);
  const FARAQ_NORM = normalizeForKwMatch("فارق");
  const HAYAH_NORM = normalizeForKwMatch("الحياة");
  const DEATH_NEGATORS = new Set(
    ["لم", "ما", "لا", "ولم", "وما", "ولا"].map(normalizeForKwMatch)
  );
  // Bare (article-free) forms; tokenMatchesKw handles الـ prefix via rule 2.
  const NON_PERSON_SUBJ_NORMS = [
    "بطارية", "موبايل", "سيارة", "زرع",
  ].map(normalizeForKwMatch);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Two-token phrase: فارق الحياة (ordered, الحياة within 2 ahead)
    if (tokenMatchesKw(t, FARAQ_NORM) ||
        (t.length >= 2 && _BURN_SINGLE.includes(t[0]) && tokenMatchesKw(t.slice(1), FARAQ_NORM))) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], HAYAH_NORM)) {
          let negated = false;
          for (let k = Math.max(0, i - 2); k < i; k++) {
            if (DEATH_NEGATORS.has(tokens[k])) { negated = true; break; }
          }
          if (!negated) return true;
        }
      }
    }

    // Single-token death words
    if (!DEATH_KW_NORMS.some(v => tokenMatchesKw(t, v))) continue;

    // Guard 1: negation within 2 tokens before
    let negated = false;
    for (let k = Math.max(0, i - 2); k < i; k++) {
      if (DEATH_NEGATORS.has(tokens[k])) { negated = true; break; }
    }
    if (negated) continue;

    // Guard 2: non-person subject within ±3 tokens
    let nonPerson = false;
    for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
      if (j !== i && NON_PERSON_SUBJ_NORMS.some(v => tokenMatchesKw(tokens[j], v))) {
        nonPerson = true;
        break;
      }
    }
    if (nonPerson) continue;

    return true;
  }
  return false;
}

/** Returns true when the facts describe fire damage (property/structural fire,
 * not body-injury burns already covered by factsMatchBurning).
 * حرق alone is guarded: suppressed when within 3 tokens of a body-part word.
 * @param {string} facts @returns {boolean} */
export function factsMatchFireDamage(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const bodyNorms = BODY_PART_KW.map(normalizeForKwMatch);

  // Direct fire tokens — no body-part guard needed
  const FIRE_DIRECT_NORMS = [
    "حريق", "حريقة", "احترق", "احترقت", "اشتعل", "اشتعلت",
    "أحرق", "أحرقت", "أضرم",
  ].map(normalizeForKwMatch);

  // حرق (verb) — fires only when NOT within 3 tokens of a body-part word
  const HARQ_VERB_NORM = normalizeForKwMatch("حرق");

  // ولّع/ولع + النار ordered within 2
  const WALLA3_NORM = normalizeForKwMatch("ولع");

  // اندلع + النار/الحريق ordered within 2
  const INDALAA3_NORM = normalizeForKwMatch("اندلع");
  const HARIQ_NOUN_NORM = normalizeForKwMatch("الحريق");

  // Negation guard: a fire token does not count when preceded within 2 tokens
  // by any of these words.
  const FIRE_NEGATORS = new Set(
    ["لم", "ما", "لا", "دون", "بدون", "بلا", "غير", "ولم", "وما", "ولا", "ودون"]
      .map(normalizeForKwMatch)
  );

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Direct fire tokens (tokenMatchesKw handles و/ف prefix and article variants)
    if (FIRE_DIRECT_NORMS.some(v => tokenMatchesKw(t, v))) {
      let negated = false;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (FIRE_NEGATORS.has(tokens[k])) { negated = true; break; }
      }
      if (!negated) return true;
    }

    // حرق (verb) — negation guard, then body-part proximity guard
    if (tokenMatchesKw(t, HARQ_VERB_NORM)) {
      let negated = false;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (FIRE_NEGATORS.has(tokens[k])) { negated = true; break; }
      }
      if (!negated) {
        let nearBody = false;
        for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
          if (j !== i && bodyNorms.some(v => tokenMatchesKw(tokens[j], v))) {
            nearBody = true;
            break;
          }
        }
        if (!nearBody) return true;
      }
    }

    // ولّع/ولع + النار (ordered: ولع first, النار within 2 ahead)
    if (tokenMatchesKw(t, WALLA3_NORM)) {
      let negated = false;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (FIRE_NEGATORS.has(tokens[k])) { negated = true; break; }
      }
      if (!negated) {
        for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
          if (tokenMatchesKw(tokens[j], NNAR_NORM)) return true;
        }
      }
    }

    // اندلع + النار/الحريق (ordered: اندلع first, target within 2 ahead)
    if (tokenMatchesKw(t, INDALAA3_NORM)) {
      let negated = false;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (FIRE_NEGATORS.has(tokens[k])) { negated = true; break; }
      }
      if (!negated) {
        for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
          if (tokenMatchesKw(tokens[j], NNAR_NORM) ||
              tokenMatchesKw(tokens[j], HARIQ_NOUN_NORM)) return true;
        }
      }
    }
  }
  return false;
}

/** Returns true when the facts describe a serious injury: a bone fracture or
 * a hot/caustic liquid poured on a person.  Burns alone without the pour
 * pattern do not fire.
 * @param {string} facts @returns {boolean} */
export function factsMatchSeriousInjury(facts) {
  return factsMatchBoneBreak(facts) || factsMatchHotLiquidPour(facts);
}

/** Returns true when the hot/caustic-liquid-pour pattern fired AND a
 * dangerous-site target (face/eye/head/nose/mouth/throat/ear) is within
 * 4 tokens of the liquid noun.
 * @param {string} facts @returns {boolean} */
export function factsMatchDangerousSite(facts) {
  const result = _hotLiquidPourResult(facts);
  if (result === null) return false;
  const { tokens, liquidPos } = result;
  for (let d = Math.max(0, liquidPos - 4); d <= Math.min(tokens.length - 1, liquidPos + 4); d++) {
    if (DANGER_SITE_NORMS.some(v => tokenMatchesKw(tokens[d], v))) return true;
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

/** Returns true when the facts contain any demand for money, payment, or a
 * financial/legal document.  No negation guard applied — a conditional
 * threat-to-pay is still a demand.
 * Excludes "دفعه/دفعها/دفعني/دفعهم" (push, not pay) via exact-match on "دفع".
 * @param {string} facts @returns {boolean} */
export function factsMatchMoneyDemand(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // (1) Money nouns and financial/legal document keywords.
  // "دفعة" (installment) is excluded: it normalises to "دفعه", colliding with
  // "دفعه" (he pushed him). Payment-installment context is rare in extortion;
  // the demand verbs and other money KW cover the gap.
  const EXTRA_NORMS = [
    "جنيه", "جنيهات", "دولار", "دولارات", "قروش", "كاش",
    "مليون", "ملايين", "ألف", "آلاف",
    "تحويل", "حوالة", "شيك", "سند", "توقيع", "تنازل", "ورقة",
  ].map(normalizeForKwMatch);
  const ALL_MONEY_NORMS = [
    ...MONEY_NOUN_KW.filter(k => k !== "دفعة").map(normalizeForKwMatch),
    ...EXTRA_NORMS,
  ];

  // (2) Demand verbs — "دفع" excluded here; handled separately with exact match
  //     to avoid matching "دفعه" (he pushed him).
  const DEMAND_VERB_NORMS = [
    "ادفع", "يدفع", "تدفع", "ادفعوا", "يدفعوا",
    "سلّم", "سلم", "يسلّم", "يسلم", "تسلّم",
    "جيب", "جيبوا", "يجيب", "تجيب",
    "حوّل", "حول", "يحوّل", "تحوّل",
    "أعطني", "اديني", "يديني", "يعطيه", "يعطيني",
  ].map(normalizeForKwMatch);
  const DAFA3_EXACT = normalizeForKwMatch("دفع");

  // (3) Ordered طلب/يطلب/طالب + منه/مني/منها within 2 tokens ahead
  const TALAB_NORMS = ["طلب", "يطلب", "طالب"].map(normalizeForKwMatch);
  const MINHU_NORMS = ["منه", "مني", "منها"].map(normalizeForKwMatch);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Check (1): money noun or document
    if (ALL_MONEY_NORMS.some(v => tokenMatchesKw(t, v))) return true;

    // Check (2): demand verb (general)
    if (DEMAND_VERB_NORMS.some(v => tokenMatchesKw(t, v))) return true;

    // Check (2): "دفع" bare exact match only (excludes دفعه = pushed him)
    if (t === DAFA3_EXACT) return true;

    // Check (3): طلب/يطلب/طالب + منه/مني/منها within 2 tokens ahead
    if (TALAB_NORMS.some(v => tokenMatchesKw(t, v))) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (MINHU_NORMS.some(v => tokenMatchesKw(tokens[j], v))) return true;
      }
    }
  }
  return false;
}

// ── Commit 38: no-apparent-offence detectors ─────────────────────────────────

const _DMG_NEGATORS = new Set(
  ["لم", "ما", "لا", "ولم", "وما", "ولا"].map(normalizeForKwMatch)
);

const _DAMAGE_VERB_NORMS = [
  "كسر", "كسرت", "كسرته", "كسرها", "تكسير",
  "حطم", "هشم", "خرب", "اتلف",
  "مزق", "ثقب", "خدش",
  "انكسر", "انكسرت", "تحطم",
].map(normalizeForKwMatch);

/** True when a property-damage verb appears within 3 tokens of a property noun,
 *  with no BODY_PART_KW token within 3 of the verb (injury ≠ property damage)
 *  and no negation within 2 tokens before the verb.
 *  @param {string} facts @returns {boolean} */
export function factsMatchPropertyDamage(facts) {
  const tokens = normalizeForKwMatch(facts)
    .split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  const PROPERTY_NOUN_NORMS = [
    "زجاج", "قزاز", "قفل", "باب", "شباك", "نافذة",
    "سيارة", "عربية", "عربة", "موتر",
    "حائط", "حيطة", "سور", "جدار",
    "لمبة", "شاشة", "هاتف", "تلفون", "موبايل", "لابتوب", "كمبيوتر",
    "أثاث", "كرسي", "طاولة", "ترابيزة",
    "دكان", "محل", "بضاعة", "زرع", "مزرعة", "مواسير", "أنبوب",
  ].map(normalizeForKwMatch);

  const bodyNorms = BODY_PART_KW.map(normalizeForKwMatch);

  for (let i = 0; i < tokens.length; i++) {
    if (!_DAMAGE_VERB_NORMS.some(v => tokenMatchesKw(tokens[i], v))) continue;

    // Negation guard
    let negated = false;
    for (let k = Math.max(0, i - 2); k < i; k++) {
      if (_DMG_NEGATORS.has(tokens[k])) { negated = true; break; }
    }
    if (negated) continue;

    // Body-part guard: injury context, not property damage
    let nearBody = false;
    for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
      if (j !== i && bodyNorms.some(v => tokenMatchesKw(tokens[j], v))) {
        nearBody = true; break;
      }
    }
    if (nearBody) continue;

    // Property noun within 3
    for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
      if (j !== i && PROPERTY_NOUN_NORMS.some(v => tokenMatchesKw(tokens[j], v))) {
        return true;
      }
    }
  }
  return false;
}

/** True when the facts contain a token or phrase indicating an accidental /
 *  unintentional act (عرضاً, صدفة, خطأ, دون قصد, لم يقصد, غير متعمد, etc.).
 *  Negation guard (same set as factsMatchDeath) applies to single-token markers.
 *  @param {string} facts @returns {boolean} */
export function factsMatchAccidentMarker(facts) {
  const tokens = normalizeForKwMatch(facts)
    .split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  const SINGLE_NORMS = [
    "عرضا",   // عرضاً / عرضا
    "صدفه",   // صدفة; بالصدفة → rule KW_ARTICLE_PREFIXES "بال"
    "خطا",    // خطأ; بالخطأ → rule KW_ARTICLE_PREFIXES "بال"
    "ارتد", "ارتدت",
    "انزلق", "انزلقت",
  ].map(normalizeForKwMatch);

  const DOUN_N   = normalizeForKwMatch("دون");
  const GHAIR_N  = normalizeForKwMatch("غير");
  const QASAD_N  = normalizeForKwMatch("قصد");
  const LAM_N    = normalizeForKwMatch("لم");
  const MA_N     = normalizeForKwMatch("ما");
  const YAQSID_N = normalizeForKwMatch("يقصد");
  const TAAMAD_N = normalizeForKwMatch("تعمد");
  const YATMD_N  = normalizeForKwMatch("يتعمد");
  const MUTMD_N  = normalizeForKwMatch("متعمد");
  const QASID_N  = normalizeForKwMatch("قاصد");
  const KAN_N    = normalizeForKwMatch("كان");
  const ATHNAA_N = normalizeForKwMatch("أثناء");
  const SAQAT_N  = normalizeForKwMatch("سقط");
  const WAQA3_N  = normalizeForKwMatch("وقع");
  const ALAYH_N  = normalizeForKwMatch("عليه");

  const PLAY_NORMS = [
    "لعب", "اللعب", "مباراة", "المباراة", "تدريب", "التدريب",
    "عمل", "العمل", "شغل", "الشغل",
  ].map(normalizeForKwMatch);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Single-token markers with negation guard
    if (SINGLE_NORMS.some(v => tokenMatchesKw(t, v))) {
      let negated = false;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (_DMG_NEGATORS.has(tokens[k])) { negated = true; break; }
      }
      if (!negated) return true;
    }

    // "دون/بدون/غير/بغير" + "قصد" within 2
    if (tokenMatchesKw(t, DOUN_N) || tokenMatchesKw(t, GHAIR_N)) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], QASAD_N)) return true;
      }
    }

    // "لم" + يقصد/يتعمد within 2
    if (t === LAM_N) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], YAQSID_N) || tokenMatchesKw(tokens[j], YATMD_N)) return true;
      }
    }

    // "ما" + قصد/تعمد (within 2); also "ما كان قاصد" (3-token)
    if (t === MA_N) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], QASAD_N) || tokenMatchesKw(tokens[j], TAAMAD_N)) return true;
        if (tokenMatchesKw(tokens[j], KAN_N) && j + 1 < tokens.length &&
            tokenMatchesKw(tokens[j + 1], QASID_N)) return true;
      }
    }

    // "غير/بغير" + "متعمد" within 2 (separate from the قصد check above)
    if (tokenMatchesKw(t, GHAIR_N)) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], MUTMD_N)) return true;
      }
    }

    // "أثناء" + play/work/training word within 2
    if (tokenMatchesKw(t, ATHNAA_N)) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (PLAY_NORMS.some(v => tokenMatchesKw(tokens[j], v))) return true;
      }
    }

    // "سقط/وقع" + "عليه" within 2
    if (tokenMatchesKw(t, SAQAT_N) || tokenMatchesKw(t, WAQA3_N)) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], ALAYH_N)) return true;
      }
    }
  }
  return false;
}

/** True when the facts show a rescue/necessity context: a rescue marker appears
 *  within 8 tokens of a property-damage verb or an entry verb (دخل/اقتحم/فتح).
 *  Ordered patterns: (نار|حريق)+داخل within 2; طفل+وحده within 2.
 *  @param {string} facts @returns {boolean} */
export function factsMatchRescueNecessity(facts) {
  const tokens = normalizeForKwMatch(facts)
    .split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  const ENTRY_VERB_NORMS = ["دخل", "اقتحم", "فتح"].map(normalizeForKwMatch);

  const RESCUE_SINGLE_NORMS = [
    "إنقاذ",    // لإنقاذ → rule 3 (ل prefix)
    "أنقذ", "ينقذ",
    "استغاث",   // covers استغاثة via suffix rule
    "يستغيث",
    "صراخ",     // صراخاً → suffix rule
    "يصرخ", "تصرخ",
    "محبوس", "محبوسة", "حبيس",
    "عالق", "عالقة",
    "يختنق", "تختنق",
    "غرق", "يغرق", "تغرق",
    "خطر",      // الخطر → strip article
  ].map(normalizeForKwMatch);

  const MUGHMAA_N = normalizeForKwMatch("مغمى");
  const FAQID_N   = normalizeForKwMatch("فاقد");
  const ALAYH_N   = normalizeForKwMatch("عليه");
  const WAY_N     = normalizeForKwMatch("وعي");
  const NAR_N     = normalizeForKwMatch("نار");
  const HARIQ_N   = normalizeForKwMatch("حريق");
  const DAKHL_N   = normalizeForKwMatch("داخل");
  const TIFL_N    = normalizeForKwMatch("طفل");
  const WAHD_N    = normalizeForKwMatch("وحده");

  function isNearPropertyOrEntry(pos) {
    for (let k = Math.max(0, pos - 8); k <= Math.min(tokens.length - 1, pos + 8); k++) {
      if (k === pos) continue;
      if (_DAMAGE_VERB_NORMS.some(v => tokenMatchesKw(tokens[k], v))) return true;
      if (ENTRY_VERB_NORMS.some(v => tokenMatchesKw(tokens[k], v))) return true;
    }
    return false;
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Single-token rescue markers
    if (RESCUE_SINGLE_NORMS.some(v => tokenMatchesKw(t, v))) {
      if (isNearPropertyOrEntry(i)) return true;
      continue;
    }

    // "مغمى عليه"
    if (tokenMatchesKw(t, MUGHMAA_N) &&
        i + 1 < tokens.length && tokenMatchesKw(tokens[i + 1], ALAYH_N)) {
      if (isNearPropertyOrEntry(i)) return true;
    }

    // "فاقد الوعي"
    if (tokenMatchesKw(t, FAQID_N) &&
        i + 1 < tokens.length && tokenMatchesKw(tokens[i + 1], WAY_N)) {
      if (isNearPropertyOrEntry(i)) return true;
    }

    // (نار|حريق) + داخل within 2
    if (tokenMatchesKw(t, NAR_N) || tokenMatchesKw(t, HARIQ_N)) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], DAKHL_N)) {
          if (isNearPropertyOrEntry(i)) return true;
        }
      }
    }

    // طفل + وحده within 2
    if (tokenMatchesKw(t, TIFL_N)) {
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 2); j++) {
        if (tokenMatchesKw(tokens[j], WAHD_N)) {
          if (isNearPropertyOrEntry(i)) return true;
        }
      }
    }
  }
  return false;
}

// ── Participation vocabulary (Commit 39) ─────────────────────────────────────
// Fires when facts describe more than one actor — formal or colloquial.
// Guard: "واحد" alone (no second-actor token within 12) does not fire.

const _PARTICIP_SINGLE_KW = [
  // colloquial Sudanese Arabic — group/companion references
  "ناس", "ناسو", "جماعته", "رفقاه", "رفقاتو", "صحابه", "صحابو",
  "زملاءه", "زملاه",
  // colloquial group nouns
  "عصابة", "مجموعة", "شلة",
  // colloquial numerals
  "اتنين", "تلاتة",
  // formal Arabic
  "شارك", "اشترك", "شركاء", "شريك", "مشارك", "مشاركة", "اشتراك",
];

const _PARTICIP_ADJACENT_KW = [
  "الجماعة ديل",
  "الجماعة دي",
  "مع آخرين",
  "مع زول",
  "ثلاثة منهم",
];

// Ordered pattern tokens: first-actor then second-actor within 12 positions.
const _PARTICIP_FIRST_N = ["واحد", "الأول"].map(normalizeForKwMatch);
const _PARTICIP_SECOND_N = ["التاني", "الثاني", "الآخر", "الأخرى"].map(normalizeForKwMatch);

export function factsMatchParticipation(facts) {
  if (factsMatchKeywords(facts, _PARTICIP_SINGLE_KW)) return true;
  if (factsMatchKeywords(facts, _PARTICIP_ADJACENT_KW)) return true;
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    if (!_PARTICIP_FIRST_N.some(f => tokenMatchesKw(toks[i], f))) continue;
    const limit = Math.min(toks.length, i + 13);
    for (let j = i + 1; j < limit; j++) {
      if (_PARTICIP_SECOND_N.some(s => tokenMatchesKw(toks[j], s))) return true;
    }
  }
  return false;
}
