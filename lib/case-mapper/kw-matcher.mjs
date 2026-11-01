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
  // NOTE: "ناس"/"ناسو" are handled separately with a crowd-context guard (see below)
  "جماعته", "رفقاه", "رفقاتو", "صحابه", "صحابو",
  "زملاءه", "زملاه",
  // colloquial group nouns
  "عصابة", "مجموعة", "شلة",
  // colloquial numerals
  "اتنين", "تلاتة",
  // formal Arabic
  "شارك", "اشترك", "مشارك", "مشاركة", "اشتراك",
  // participation verbs (unconditional triggers per Addendum 2)
  "حرّض", "أعان",
];

// "ناس"/"ناسو" fire as co-criminal markers UNLESS preceded within 2 tokens by a
// crowd/place preposition (أمام/وسط/قدام/بين/مع) — those phrases describe the scene,
// not a second actor.  "شهد شخصان" does not contain these nouns so is unaffected.
const _CROWD_NOUNS_KW = ["ناس", "ناسو"].map(normalizeForKwMatch);
const _CROWD_PREPS_KW = ["امام", "وسط", "قدام", "بين", "مع"].map(normalizeForKwMatch);

const _PARTICIP_ADJACENT_KW = [
  "الجماعة ديل",
  "الجماعة دي",
  "مع آخرين",
  // "مع زول" moved to _matchMaaZol (case 3 fix): "اتشاكل مع زول" names the
  // other party to the fight, not a co-offender.
  "ثلاثة منهم",
  "اتفق مع",
];

// Ordered pattern tokens: first-actor then second-actor within 12 positions.
const _PARTICIP_FIRST_N = ["واحد", "الأول"].map(normalizeForKwMatch);
const _PARTICIP_SECOND_N = ["التاني", "الثاني", "الآخر", "الأخرى"].map(normalizeForKwMatch);

// Conjunction+crime-act gate (Addendum 2): واو-prefixed companion token + crime verb → participation.
// "وشريكه" is a single token (no space); differs from "إلى شريكه" (two tokens, no واو prefix).
const _CONJ_ACTOR_NORMS = [
  "وشريكه","وشريكها","وشركاءه","وصديقه","وصاحبه","وأخيه","ورفيقه",
].map(normalizeForKwMatch);

const _CRIME_ACT_KW = [
  "سرق","أخذ","شال","استولى","اختلس","نهب",
  "لم يرد","لم يعيد","لم يسلم",
  "ضرب","طعن","اعتدى",
  "غيّر","عدّل","زوّر","دوّن",
  "باع","تصرف","بدد",
  "حرّض","أعان","اتفق",
];

function _matchConjCrime(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  if (!_CONJ_ACTOR_NORMS.some(kw => toks.some(t => tokenMatchesKw(t, kw)))) return false;
  return factsMatchKeywords(facts, _CRIME_ACT_KW);
}

export function factsMatchParticipation(facts) {
  if (factsMatchKeywords(facts, _PARTICIP_SINGLE_KW)) return true;
  if (factsMatchKeywords(facts, _PARTICIP_ADJACENT_KW)) return true;
  if (_matchConjCrime(facts)) return true;
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  // ناس/ناسو: co-criminal marker only when NOT in crowd/place context
  for (let i = 0; i < toks.length; i++) {
    if (!_CROWD_NOUNS_KW.some(n => tokenMatchesKw(toks[i], n))) continue;
    let crowdCtx = false;
    for (let k = Math.max(0, i - 2); k < i; k++) {
      if (_CROWD_PREPS_KW.some(p => tokenMatchesKw(toks[k], p))) { crowdCtx = true; break; }
    }
    if (!crowdCtx) return true;
  }
  for (let i = 0; i < toks.length; i++) {
    if (!_PARTICIP_FIRST_N.some(f => tokenMatchesKw(toks[i], f))) continue;
    const limit = Math.min(toks.length, i + 13);
    for (let j = i + 1; j < limit; j++) {
      if (_PARTICIP_SECOND_N.some(s => tokenMatchesKw(toks[j], s))) return true;
    }
  }
  // Commit 41: proximity-constrained vocabulary (defined below)
  if (_matchProxNew(toks)) return true;
  if (_matchMaaZol(toks)) return true;
  return false;
}

// Case 3 fix: "مع زول" marks a companion only when it does not follow a verb of
// quarrel/meeting — after those verbs the زول is the victim or the other party.
const _QUARREL_STEMS_N = [
  "اتشاكل", "تشاكل", "اتشاجر", "تشاجر", "اتخانق", "تخانق", "اتعارك", "تعارك",
  "اتضارب", "تضارب", "اختلف", "اتخالف", "اتلاقي", "التقي", "اتكلم", "اتنازع", "تنازع",
  "مشكله", "شكله", "خناقه", "عركه", "خلاف", "نزاع", "مضاربه", "شجار",
].map(normalizeForKwMatch);

function _matchMaaZol(toks) {
  const MAA = normalizeForKwMatch("مع"), ZOL = normalizeForKwMatch("زول");
  for (let i = 0; i + 1 < toks.length; i++) {
    if (toks[i] !== MAA || !tokenMatchesKw(toks[i + 1], ZOL)) continue;
    let quarrel = false;
    for (let k = Math.max(0, i - 2); k < i; k++) {
      if (_QUARREL_STEMS_N.some(q => tokenMatchesKw(toks[k], q))) { quarrel = true; break; }
    }
    if (!quarrel) return true;
  }
  return false;
}

// ── Gross-negligence markers (Commit 40, Change A) ───────────────────────────
// Guard for إهمال:فحص:قتل card. When these markers appear the card does NOT fire
// because the negligence is clear-cut (phone use, drunk driving, red-light running).

const _GROSS_NEG_KW = [
  "ينظر إلى هاتفه",   // looking at his phone while driving
  "يستعمل هاتفه",      // using his phone while driving
  "إشارة حمراء",       // red light
  "تجاوز الإشارة",     // ignored the traffic signal
  "مخمور",             // intoxicated
  "سكران",             // drunk
  "تحت تأثير",         // under the influence
];

export function factsMatchGrossNegligence(facts) {
  return factsMatchKeywords(facts, _GROSS_NEG_KW);
}

// ── Vehicle tokens (Commit 40, Change C) ─────────────────────────────────────
// Fires when facts involve a vehicle — used to attach traffic-law-2010 as
// related legislation for قتل خطأ / جرح خطأ cases.

const _VEHICLE_KW = [
  "سيارة",      // car
  "مركبة",      // vehicle (generic)
  "شاحنة",      // truck / lorry
  "حافلة",      // bus
  "موتوسيكل",   // motorcycle
  "تاكسي",      // taxi
  "باص",        // bus (colloquial)
  "دهس",        // ran over (implies vehicle involvement)
  // Sudanese colloquial vehicles and collision verbs (case 8 fix)
  "ركشة", "تكتك", "عربية", "عربة", "موتر", "دفار", "امجاد", "بوكسي", "لوري", "هايس",
  "صدم", "صدمت", "صدمه", "صدمها", "دعس", "دعسه", "دعسها",
];

export function factsMatchVehicle(facts) {
  return factsMatchKeywords(facts, _VEHICLE_KW);
}

// ── Hadd-theft conditions (Commit 41, Change A) ───────────────────────────────
// Returns true ONLY when ALL five hadd preconditions appear explicitly in the facts.
// Any one missing → false.  Negation guard: لم/لا/ما/غير/دون/ليس/ليست within 2
// tokens before a condition keyword cancels that group.

const _H_NEG = new Set(["لم", "لا", "ما", "غير", "دون", "ليس", "ليست", "لن"].map(normalizeForKwMatch));

function _hNeg(toks, pos) {
  for (let k = Math.max(0, pos - 2); k < pos; k++) {
    if (_H_NEG.has(toks[k])) return true;
  }
  return false;
}

// (i) Capacity — adult / sane / free agent, or عمره + age ≥ 18
const _CAP_KW = ["بالغ", "عاقل", "واع", "مختار", "راشد"].map(normalizeForKwMatch);
const _AGE_TOK   = normalizeForKwMatch("عمره");
const _DEC_KW    = ["عشرون", "ثلاثون", "اربعون", "خمسون", "ستون"].map(normalizeForKwMatch);
const _COMP2_KW  = ["وعشرون", "وثلاثون", "واربعون", "وخمسون", "وستون"].map(normalizeForKwMatch);

function _hCap(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (_CAP_KW.some(k => tokenMatchesKw(toks[i], k)) && !_hNeg(toks, i)) return true;
  }
  for (let i = 0; i < toks.length; i++) {
    if (!tokenMatchesKw(toks[i], _AGE_TOK) || _hNeg(toks, i)) continue;
    const lim = Math.min(toks.length, i + 5);
    for (let j = i + 1; j < lim; j++) {
      const t = toks[j];
      const n = parseInt(t, 10);
      if (!isNaN(n) && n >= 18) return true;
      if (_DEC_KW.some(d => tokenMatchesKw(t, d))) return true;
      if (_COMP2_KW.some(d => tokenMatchesKw(t, d))) return true;
      if ((t === "ثمانيه" || t === "تسعه") && j + 1 < toks.length && toks[j + 1] === "عشر") return true;
    }
  }
  return false;
}

// (ii) Secrecy — took it without the owner's knowledge
const _SEC_SINGLE = ["سرا", "خفيه", "متخفيا"].map(normalizeForKwMatch);
const _SEC_PHRASE = [["دون", "علم"], ["بدون", "علم"], ["في", "غفله"]];
const _LAYLA_N   = normalizeForKwMatch("ليلا");
const _CLOSED_N  = ["مقفول", "مغلق"].map(normalizeForKwMatch);

function _hSec(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (_SEC_SINGLE.some(k => tokenMatchesKw(toks[i], k)) && !_hNeg(toks, i)) return true;
  }
  for (const ph of _SEC_PHRASE) {
    for (let i = 0; i <= toks.length - ph.length; i++) {
      if (ph.every((kt, j) => tokenMatchesKw(toks[i + j], kt)) && !_hNeg(toks, i)) return true;
    }
  }
  let hasLayla = false, hasClosed = false;
  for (let i = 0; i < toks.length; i++) {
    if (tokenMatchesKw(toks[i], _LAYLA_N) && !_hNeg(toks, i)) hasLayla = true;
    if (_CLOSED_N.some(k => tokenMatchesKw(toks[i], k)) && !_hNeg(toks, i)) hasClosed = true;
  }
  return hasLayla && hasClosed;
}

// (iii) Hirz — secure storage / enclosure
const _HIRZ_SINGLE = ["خزنه", "خزينه", "قفل", "مقفول", "مغلق", "سور", "حرز", "محروس"].map(normalizeForKwMatch);
const _HIRZ_PHRASE = [["نافذه", "مغلقه"], ["باب", "مغلق"], ["محل", "مغلق"]];

function _hHirz(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (_HIRZ_SINGLE.some(k => tokenMatchesKw(toks[i], k)) && !_hNeg(toks, i)) return true;
  }
  for (const ph of _HIRZ_PHRASE) {
    for (let i = 0; i <= toks.length - ph.length; i++) {
      if (ph.every((kt, j) => tokenMatchesKw(toks[i + j], kt)) && !_hNeg(toks, i)) return true;
    }
  }
  return false;
}

// (iv) Ownership by another — المال ليس ملك الجاني
const _OWN_SINGLE = ["لصاحب", "لصاحبه", "للغير"].map(normalizeForKwMatch);
const _OWN_PHRASE = [["مملوك", "ل"], ["المملوك", "ل"], ["ملك", "ل"], ["ملكا", "ل"]];

function _hOwn(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (_OWN_SINGLE.some(k => tokenMatchesKw(toks[i], k)) && !_hNeg(toks, i)) return true;
  }
  for (const ph of _OWN_PHRASE) {
    for (let i = 0; i <= toks.length - ph.length; i++) {
      if (ph.every((kt, j) => tokenMatchesKw(toks[i + j], kt)) && !_hNeg(toks, i)) return true;
    }
  }
  return false;
}

// (v) No doubt / no necessity — نفي الشبهة وحالة الاضطرار
const _NODOUBT_PH = [
  ["لا", "شبهه"],
  ["لا", "ملكيه"],
  ["لا", "حصه"],
  ["لا", "مطالبه"],
  ["لا", "اضطرار"],
  ["دون", "اذن"],
  ["ولا", "اذن"],
  ["غير", "مضطر"],
  ["ليست", "له", "ملكيه"],
  ["لم", "يكن", "مضطرا"],
  ["لم", "يكن", "في", "حاله", "جوع"],
];

function _hNoDout(toks) {
  for (const ph of _NODOUBT_PH) {
    for (let i = 0; i <= toks.length - ph.length; i++) {
      if (ph.every((kt, j) => tokenMatchesKw(toks[i + j], kt))) return true;
    }
  }
  return false;
}

export function factsMatchHaddTheftConditions(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  return _hCap(toks) && _hSec(toks) && _hHirz(toks) && _hOwn(toks) && _hNoDout(toks);
}

// ── Delivery detector (Commit 41, Change A) ───────────────────────────────────
// Returns true when a delivery verb appears un-negated AND no رفض/رفضت guard fires.
// "رفض/رفضت" within 3 tokens of a money/delivery noun → forces false regardless.

const _DLVR_NEGATORS = new Set(["لم", "لا", "ما", "ولم", "وما"].map(normalizeForKwMatch));
const _DLVR_KW       = ["حول", "حولت", "دفع", "دفعت", "سلم", "سلمت", "اعطاه", "اعطته", "سدد"].map(normalizeForKwMatch);
const _DLVR_PHRASE   = [["ارسل", "المبلغ"]];  // أرسل → ارسل after normalisation
const _RAFAD_N       = new Set(["رفض", "رفضت"].map(normalizeForKwMatch));
const _MONEY_DLVR_N  = ["دفع", "تحويل", "مبلغ", "المال", "الفلوس", "الدفع", "التحويل", "السداد", "تسليم"].map(normalizeForKwMatch);

function _deliveryRejected(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (!_RAFAD_N.has(toks[i])) continue;
    for (let j = Math.max(0, i - 3); j <= Math.min(toks.length - 1, i + 3); j++) {
      if (j === i) continue;
      if (_MONEY_DLVR_N.some(mn => tokenMatchesKw(toks[j], mn))) return true;
    }
  }
  return false;
}

export function factsMatchDelivery(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  if (_deliveryRejected(toks)) return false;
  for (let i = 0; i < toks.length; i++) {
    if (!_DLVR_KW.some(k => tokenMatchesKw(toks[i], k))) continue;
    let neg = false;
    for (let k = Math.max(0, i - 2); k < i; k++) {
      if (_DLVR_NEGATORS.has(toks[k])) { neg = true; break; }
    }
    if (!neg) return true;
  }
  for (const ph of _DLVR_PHRASE) {
    for (let i = 0; i <= toks.length - ph.length; i++) {
      if (!ph.every((kt, j) => tokenMatchesKw(toks[i + j], kt))) continue;
      let neg = false;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (_DLVR_NEGATORS.has(toks[k])) { neg = true; break; }
      }
      if (!neg) return true;
    }
  }
  return false;
}

// ── Weapon + public-place gate (Commit 41, Change A) ─────────────────────────
// Returns true when BOTH a weapon token AND a public-place token appear in the facts.

const _WEAPON_KW = [
  "مطوه", "مطواه",             // مطوة/مطواة → ه after normalisation
  "سكين", "سكينه",              // knife
  "موس",                         // razor
  "خنجر",                        // dagger
  "سلاح", "مسدس",               // firearm / weapon
  "بندقيه",                      // rifle
  "عصا حديديه",                  // iron rod (phrase)
  "سيخ",                         // metal skewer
  "ساطور",                       // cleaver
];

const _PLACE_KW = [
  "الطريق", "الشارع", "الموقف", "المحطه", "السوق",  // المحطة → ه
  "الطريق العام",        // two-token phrase
  "خارج العمران",        // two-token phrase
  "البر", "الخلاء",      // open country / deserted place
];

export function factsMatchWeaponPublicPlace(facts) {
  return factsMatchKeywords(facts, _WEAPON_KW) && factsMatchKeywords(facts, _PLACE_KW);
}

// ── Narcotics-context gate (Commit 43, Fix 1) ────────────────────────────────
// Closed list of substance names and proxies. Used to decide whether a case
// is narcotics-related WITHOUT consulting the LLM result — so the lab-pending
// gate fires even when the LLM abstains or routes civil.

const _NARCOTICS_CONTEXT_KW = [
  "مخدر", "مخدرة", "مخدرات", "المخدرات",
  "بنقو", "حشيش", "هيروين", "كوكايين", "ترامادول", "كبتاجون", "آيس",
  "مؤثرات عقلية", "مادة مشتبه", "لفافات", "أكياس صغيرة",
];

export function factsMatchNarcoticsContext(facts) {
  return factsMatchKeywords(facts, _NARCOTICS_CONTEXT_KW);
}

// ── Lab-pending gate (Commit 42, Change A) ───────────────────────────────────

const _LAB_PENDING_KW = [
  "اشتبهت", "اشتبه", "مشتبه", "يشتبه", "مادة مشتبه",
  "قيد الفحص", "قيد التحليل",
  "لم تصدر النتيجة", "لم تصدر نتيجة",
  "دون أن تكون نتيجة",
  "أرسلت إلى المعمل", "أُرسلت للمعمل",
  "أرسلت المضبوطات",
  "بانتظار المعمل", "بانتظار نتيجة",
];

/** Returns true when facts indicate a lab result is still pending (substance
 * identity not yet established). Guard: returns false when أثبت/أثبتت/أكد
 * appears within 3 tokens (bidirectional) of المعمل/التقرير/الفحص — that
 * means a result already exists.
 * @param {string} facts @returns {boolean} */
export function factsMatchLabPending(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  // Guard: confirmation pattern invalidates the "pending" signal
  const CONFIRM_VERBS = new Set(["اثبت", "اثبتت", "اكد"]); // أ→ا after normalise
  const CONFIRM_NOUNS = new Set(["المعمل", "التقرير", "الفحص"]);
  for (let i = 0; i < tokens.length; i++) {
    if (!CONFIRM_VERBS.has(tokens[i])) continue;
    const lo = Math.max(0, i - 3), hi = Math.min(tokens.length - 1, i + 3);
    for (let j = lo; j <= hi; j++) {
      if (j !== i && CONFIRM_NOUNS.has(tokens[j])) return false;
    }
  }
  return factsMatchKeywords(facts, _LAB_PENDING_KW);
}

// ── Knowledge-dispute gate (Commit 42, Change A) ─────────────────────────────

const _POSS_RECV_KW = [
  "اشترى", "اشتراه", "بحوزته", "بحوزة", "في حوزته",
  "وجد معه", "عثر", "ضبط", "استلم", "تسلم", "حفظ",
  "خليها عندك", "جاب لي", "كرتونة", "حقيبة",
];

const _KNOW_DENY_KW = [
  "أنكر علمه", "أنكر", "لا يعرف", "ما عارف", "ما يعرف",
  "لم يكن يعلم", "ما كان عارف", "لا يعلم",
  "ما سألت", "ما سألتو", "لم يسأل",
  "لم يفتحها", "ما فتحها",
  "تخص شخصاً آخر", "تخص أحد الركاب", "قال إنه اشتراه",
];

const _KNOW_ADMIT_KW = [
  "كان يعلم", "عارف إنها", "كان عارف", "يعلم أنها مسروقة",
  "أقر بعلمه", "اعترف",
];

/** Returns "admitted" when an explicit knowledge admission appears, "disputed"
 * when a possession/receipt token appears within 25 tokens of a
 * knowledge-denial/uncertainty token, or null when neither pattern fires.
 * @param {string} facts @returns {"admitted"|"disputed"|null} */
export function factsMatchKnowledgeDisputed(facts) {
  // Explicit admission takes priority
  if (factsMatchKeywords(facts, _KNOW_ADMIT_KW)) return "admitted";

  // Possession + denial within 25 tokens
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // Collect positions of possession and denial tokens
  const possPositions = [];
  const denyPositions = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Check possession single-token keywords
    for (const kw of _POSS_RECV_KW) {
      const kwToks = normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
      if (kwToks.length === 1) {
        if (tokenMatchesKw(t, kwToks[0])) { possPositions.push(i); break; }
      } else {
        // multi-token: check contiguous match starting at i
        if (kwToks.every((kt, j) => i + j < tokens.length && tokenMatchesKw(tokens[i + j], kt))) {
          possPositions.push(i); break;
        }
      }
    }
    for (const kw of _KNOW_DENY_KW) {
      const kwToks = normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
      if (kwToks.length === 1) {
        if (tokenMatchesKw(t, kwToks[0])) { denyPositions.push(i); break; }
      } else {
        if (kwToks.every((kt, j) => i + j < tokens.length && tokenMatchesKw(tokens[i + j], kt))) {
          denyPositions.push(i); break;
        }
      }
    }
  }

  for (const pp of possPositions) {
    for (const dp of denyPositions) {
      if (Math.abs(pp - dp) <= 25) return "disputed";
    }
  }
  return null;
}

// ── Consent-dispute gate (Commit 42 + Commit 44) ─────────────────────────────
// Commit 44: "contested" requires a specific counter-claim pattern, not just a
// bare consent noun.  A consent noun preceded within 2 tokens by a negation
// (دون/بدون/بغير/بلا/عدم/من غير/رغم عدم) counts as explicit REFUSAL and never
// as a contest — so "دون رضاها" and "بغير رضاها" no longer trigger the card.

const _SEXUAL_ACT_KW = [
  "واقعها", "جامعها", "اغتصب", "اغتصبها", "علاقة جنسية", "مارس الجنس",
  "لمس", "أمسك بجسدها", "تحرش", "قبّلها", "حاول تقبيلها",
];

// Single-token negations of consent (within 2 tokens before a consent noun → refusal)
const _CNEG_N = new Set(["دون", "بدون", "بغير", "بلا", "عدم"].map(normalizeForKwMatch));
// Two-token pair "من غير": first=من, second=غير
const _CNEG_MN = normalizeForKwMatch("من");
const _CNEG_GHR = normalizeForKwMatch("غير");

// Counter-claim Pattern A: أنكر + (تهديد|إكراه|قوة) within 3 (bidirectional)
const _DENY_V_N  = ["انكر", "انكرت"].map(normalizeForKwMatch);
const _DENY_OBJ_N = ["تهديد", "اكراه", "قوه"].map(normalizeForKwMatch);

// Counter-claim Pattern B: ادعى/زعم/قال + non-negated consent word within 8 (forward)
const _CLAIM_V_N = ["ادعي", "ادعت", "زعم", "زعمت", "قال", "قالت"].map(normalizeForKwMatch);
const _CLAIM_CONS_N = [
  "رضا", "رضاها", "رضاه", "برضاها", "برضاه",
  "بالتراضي", "تراضي",
  "وافقت", "وافق",
  "راضيه", "راضي",
].map(normalizeForKwMatch);

// Counter-claim Pattern C: "تمت" immediately followed by "برضاها"/"برضاه"
const _TMMT_N      = normalizeForKwMatch("تمت");
const _TMMT_CONS_N = ["برضاها", "برضاه"].map(normalizeForKwMatch);

/** Returns true when the consent noun at toks[k] is preceded within 2 tokens
 * by a negation word (دون/بغير/…), meaning it signals refusal not consent. */
function _consentNounNegated(toks, k) {
  for (let j = Math.max(0, k - 2); j < k; j++) {
    if (_CNEG_N.has(toks[j])) return true;
    // "من غير" two-token pair: both j and j+1 must be before k
    if (j + 1 < k && toks[j] === _CNEG_MN && toks[j + 1] === _CNEG_GHR) return true;
  }
  return false;
}

/** Returns "contested" when the defendant makes a counter-claim (denied coercion,
 * or asserted consent); "refused" when a sexual act appears without such a claim;
 * null when no sexual-act token is present.
 * @param {string} facts @returns {"contested"|"refused"|null} */
export function factsMatchConsentDisputed(facts) {
  if (!factsMatchKeywords(facts, _SEXUAL_ACT_KW)) return null;
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  for (let i = 0; i < toks.length; i++) {
    // Pattern A: أنكر/أنكرت + (تهديد|إكراه|قوة) within 3 (bidirectional)
    if (_DENY_V_N.some(v => tokenMatchesKw(toks[i], v))) {
      const lo = Math.max(0, i - 3), hi = Math.min(toks.length - 1, i + 3);
      for (let k = lo; k <= hi; k++) {
        if (k !== i && _DENY_OBJ_N.some(o => tokenMatchesKw(toks[k], o))) return "contested";
      }
    }
    // Pattern B: ادعى/زعم/قال + non-negated consent word within 8 tokens ahead
    if (_CLAIM_V_N.some(v => tokenMatchesKw(toks[i], v))) {
      const hi = Math.min(toks.length - 1, i + 8);
      for (let k = i + 1; k <= hi; k++) {
        if (
          _CLAIM_CONS_N.some(c => tokenMatchesKw(toks[k], c)) &&
          !_consentNounNegated(toks, k)
        ) return "contested";
      }
    }
    // Pattern C: "تمت" immediately followed by "برضاها"/"برضاه"
    if (tokenMatchesKw(toks[i], _TMMT_N) && i + 1 < toks.length) {
      if (_TMMT_CONS_N.some(c => tokenMatchesKw(toks[i + 1], c))) return "contested";
    }
  }

  return "refused";
}

// ── Participation — proximity extension (Commit 41, Change A) ────────────────
// New KWs fire ONLY if within 15 tokens of a theft/entry/take verb.
// Existing _PARTICIP_SINGLE_KW / _PARTICIP_ADJACENT_KW remain unconditional.

const _THEFT_VERB_N = ["دخل", "شال", "اخذ", "اخد", "سرق", "كسر", "فتح", "سلم"].map(normalizeForKwMatch);

// "صاحبه" / "صاحبو" are omitted — too ambiguous (also means "owner") → false fires.
// They are still captured by the "مع صاحبه" phrase check below.
const _PROX_SINGLE_N = [
  "لصاحبه", "لشريكه", "شريكو",
  "يقسموا", "قسموها", "قسمو",
  "نصيبه", "نصيبو",
].map(normalizeForKwMatch);

const _BALNASS_N = normalizeForKwMatch("بالنص");  // النص بالنص / بالنص — split-proceeds phrase

function _matchProxNew(toks) {
  const theftPos = [];
  for (let i = 0; i < toks.length; i++) {
    if (_THEFT_VERB_N.some(v => tokenMatchesKw(toks[i], v))) theftPos.push(i);
  }
  if (theftPos.length === 0) return false;
  const near = (pos) => theftPos.some(tp => Math.abs(tp - pos) <= 15);

  for (let i = 0; i < toks.length; i++) {
    if (_PROX_SINGLE_N.some(k => tokenMatchesKw(toks[i], k)) && near(i)) return true;
    if (tokenMatchesKw(toks[i], _BALNASS_N) && near(i)) return true;
    // "مع صاحبه" two-token phrase
    if (i + 1 < toks.length &&
        tokenMatchesKw(toks[i], normalizeForKwMatch("مع")) &&
        tokenMatchesKw(toks[i + 1], normalizeForKwMatch("صاحبه")) &&
        near(i)) return true;
  }
  return false;
}

// ── Entrustment gate (Commit 46) ──────────────────────────────────────────────

const _ENTR_NEGATORS = new Set(["لم", "لا", "ما", "ولم", "وما"].map(normalizeForKwMatch));

const _ENTR_HANDOVER_KW = [
  "سلّم", "سلم", "سلّمت", "سلمت",
  "أعطى", "أعطته", "أعطاه",
  "أدّى", "ادى",
  "أودع", "أودعت",
  "حوّل", "حوّل له", "حول له", "حوّلت له",
  "دفع له", "دفعت له",
  "تسلّم", "تسلم", "استلم", "استلمت",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

const _ENTR_PURPOSE_KW = [
  "لشراء", "لإيداع", "ليصلح", "للإصلاح", "لإصلاح",
  "لإيصال",   // covers لإيصالها / لإيصاله (B14-139)
  "ليوصل", "ليسلّم",
  "أمانة", "وديعة", "للاحتفاظ", "ليحفظ", "لحفظه", "لحفظها",
  "بموجب اتفاق", "على أن",
  "لحسابها", "لحسابه", "لحساب",
  "وكالة", "وكّله", "وكله",
  "مؤتمن",    // trustee role (E5: "شخص مؤتمن")
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

const _ENTR_NONRETURN_KW = [
  "لم يرد", "لم يُعد", "لم يعيد",
  "ما رجّع", "ما رجع",
  "لم يسلّم", "لم يسلم",
  "أنكر الاستلام", "أنكرت استلام", "أنكر استلام",
  "استُخدمت في", "استخدمها في", "استعملها في",
  "تصرّف", "تصرف", "باع", "باعه", "باعها",
  "صرف", "صرفها", "أنفق", "بدّد",
  "لا يستطيع إعادتها",
  "رفض ردّ", "رفض إرجاع",
  "استولى", "اختلس",
];

// Bank tokens (normalized) — recipient-bank guard
const _BANK_TOKS = [
  "بنك", "البنك", "مصرف", "المصرف",
  "حساب مصرفي", "حسابه بالبنك", "حسابها بالبنك",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Deposit verbs that indicate the bank is the RECIPIENT
const _BANK_DEPOSIT_VERBS = [
  "أودع", "أودعت", "وضع", "وضعت", "حوّل", "حول",
].map(normalizeForKwMatch);

// Person/role nouns — their presence between verb and bank cancels the guard
const _PERSON_ROLE = [
  "موظف", "صديق", "شريك", "وكيل", "المتهم", "زول", "شخص",
].map(normalizeForKwMatch);

/** Returns true when the facts match an entrustment pattern: all three groups
 *  must fire — (1) handover, (2) purpose/trust, (3) non-return or diversion.
 *  Groups 1 & 2 apply a negation guard: no لم/لا/ما within 2 tokens before match.
 *  Bank guard: if a bank token appears within 4 tokens after a deposit verb with no
 *  person/role noun between them, the bank is the recipient → return false.
 *  @param {string} facts @returns {boolean} */
export function factsMatchEntrustment(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // Bank-recipient guard: bank is the direct object of a deposit verb
  for (let i = 0; i < toks.length; i++) {
    if (!_BANK_DEPOSIT_VERBS.some(v => tokenMatchesKw(toks[i], v))) continue;
    // Look up to 4 tokens ahead for a bank token
    for (let j = i + 1; j <= Math.min(i + 4, toks.length - 1); j++) {
      const matchesBank = _BANK_TOKS.some(btoks => {
        if (btoks.length === 1) return tokenMatchesKw(toks[j], btoks[0]);
        return j + btoks.length - 1 < toks.length &&
          btoks.every((bt, k) => tokenMatchesKw(toks[j + k], bt));
      });
      if (!matchesBank) continue;
      // Check if any person/role noun sits between the verb (i) and this bank token (j)
      const hasPerson = toks.slice(i + 1, j).some(t => _PERSON_ROLE.some(p => tokenMatchesKw(t, p)));
      if (!hasPerson) return false;
    }
  }

  function groupFires(phraseList) {
    for (const kwToks of phraseList) {
      const n = kwToks.length;
      outer: for (let i = 0; i <= toks.length - n; i++) {
        if (!kwToks.every((kt, j) => tokenMatchesKw(toks[i + j], kt))) continue;
        for (let k = Math.max(0, i - 2); k < i; k++) {
          if (_ENTR_NEGATORS.has(toks[k])) continue outer;
        }
        return true;
      }
    }
    return false;
  }

  return groupFires(_ENTR_HANDOVER_KW)
      && groupFires(_ENTR_PURPOSE_KW)
      && factsMatchKeywords(facts, _ENTR_NONRETURN_KW);
}

// ── Contractual-defence gate (Commit 46) ──────────────────────────────────────

const _CONTRACTUAL_DEFENCE_KW = [
  "دفع بأن العلاقة تجارية",
  "العلاقة تجارية",
  "نزاع تجاري",
  "تعرض للخسارة",
  "خسارة",
  "إخلال بالعقد",
  "شراكة",
];

/** Returns true when the facts contain a contractual-defence marker — the
 *  accused claims the relationship was commercial/contractual, not criminal.
 *  Used alongside factsMatchEntrustment to gate the أمانة:مدني open-point card.
 *  @param {string} facts @returns {boolean} */
export function factsMatchContractualDefence(facts) {
  return factsMatchKeywords(facts, _CONTRACTUAL_DEFENCE_KW);
}

// ── Trust disposal / denial detectors (Commit 50) ────────────────────────────
// DEFERRED COVERAGE GAP: gross negligence (التصرف فيه بإهمال فاحش, Art. 177(1)(e))
// is not handled here. ضاع / فقد / تركه بلا حفظ are NOT disposal markers —
// loss without a disposal act falls through to whatever the LLM path returns.

const _TRUST_NEGATORS = new Set(["لم", "لا", "ما", "ولم", "وما"].map(normalizeForKwMatch));

// Strong verbs: appropriation / direct disposal (forms 2–4 of Art. 177(1))
const _TRUST_STRONG_N = [
  "استولي", "اختلس", "بدد", "تملك",
  "باع", "بعت",   // baac / bi'tu (بعتو/بعته via suffix rule)
  "رهن",
].map(normalizeForKwMatch);

// Spend verbs: use/spend with benefit marker required within 6 tokens
const _TRUST_SPEND_N = [
  "انفق", "صرف", "حول", "استخدم", "استعمل", "دخل", "اخذ", "اخد", "سدد",
].map(normalizeForKwMatch);

// Single-token benefit markers
const _TRUST_BEN_SINGLE_N = [
  "لنفسه", "لنفسها", "حسابه", "حسابها", "لحسابه",
  "لمصلحته", "لمنفعته", "لصالح", "تجارته", "لشقيقه", "لاخيه", "لاسرته",
].map(normalizeForKwMatch);

// Multi-token benefit markers (each entry is a normalised token array)
const _TRUST_BEN_MULTI_N = [
  "علي نفسه", "علي نفسها",
  "حسابه الشخصي",
  "شغل تاني", "شغل اخر",
  "تجاره اخري",
  "دين علي", "سداد دين",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

/** factsMatchTrustDisposal — true when facts contain an un-negated disposal act
 *  (forms 2–4 of Art. 177: appropriation / conversion to own/other's benefit / dissipation).
 *  Local negation: a negator token directly before the verb cancels only that occurrence.
 *  Excluded: لم يرد / ما رجع / رفض / ضاع / فقد / خسر / تعرض للخسارة (mere non-return).
 *  @param {string} facts @returns {boolean} */
export function factsMatchTrustDisposal(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  for (let i = 0; i < toks.length; i++) {
    const negated = i > 0 && _TRUST_NEGATORS.has(toks[i - 1]);

    // Strong verb alone → disposal
    if (!negated && _TRUST_STRONG_N.some(v => tokenMatchesKw(toks[i], v))) return true;

    // Spend verb + benefit marker within 6 tokens
    if (!negated && _TRUST_SPEND_N.some(v => tokenMatchesKw(toks[i], v))) {
      for (let j = i + 1; j <= Math.min(i + 6, toks.length - 1); j++) {
        if (_TRUST_BEN_SINGLE_N.some(b => tokenMatchesKw(toks[j], b))) return true;
        for (const bToks of _TRUST_BEN_MULTI_N) {
          const n = bToks.length;
          if (j + n - 1 < toks.length &&
              bToks.every((bt, k) => tokenMatchesKw(toks[j + k], bt))) return true;
        }
      }
    }
  }
  return false;
}

// Denial-verb tokens and receipt-word tokens for factsMatchTrustDenial
const _TRUST_DENIAL_VERBS_N = ["انكر", "ينكر", "نفي"].map(normalizeForKwMatch);
const _TRUST_RECEIPT_N = ["استلام", "استلامه", "استلامها", "الاستلام", "استلم"].map(normalizeForKwMatch);
const _TRUST_JUHUD_N = normalizeForKwMatch("جحد");

// Un-negated support markers
const _TRUST_SUP_SINGLE_N = [
  "ايصال", "اقرار", "شهود", "شاهد", "شهد",
  "مستند", "توقيعه", "رسائل", "واتساب",
].map(normalizeForKwMatch);

const _TRUST_SUP_MULTI_N = [
  "اقر باستلام",
  "تحويل مصرفي",
  "ايصال تحويل",
  "موقع منه",
  "كشف حساب",
  "عقد مكتوب",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Negators for support-marker suppression (look back up to 4 tokens)
const _TRUST_SUP_NEGS = new Set([
  "لم", "لا", "ما", "ولم", "وما", "ولا", "دون", "بدون", "غير", "بلا",
].map(normalizeForKwMatch));

// Claim-context markers: presence within 4 tokens before a handover verb → claim context.
// Denial verbs are included so "استلم" inside "ينكر أنه استلم" is not a narrative handover.
const _TRUST_CLAIM_N = [
  "يدعي", "تدعي", "ادعي", "ادعت", "يزعم", "زعم", "بحسب", "يقول", "تقول", "افاد",
  "انكر", "ينكر", "نفي",
].map(normalizeForKwMatch);

function _trustHasDenial(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (tokenMatchesKw(toks[i], _TRUST_JUHUD_N)) return true;
    if (_TRUST_DENIAL_VERBS_N.some(v => tokenMatchesKw(toks[i], v))) {
      for (let j = i + 1; j <= Math.min(i + 5, toks.length - 1); j++) {
        if (_TRUST_RECEIPT_N.some(r => tokenMatchesKw(toks[j], r))) return true;
      }
    }
  }
  return false;
}

function _trustHasUnnegatedSupport(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (_TRUST_SUP_SINGLE_N.some(s => tokenMatchesKw(toks[i], s))) {
      let neg = false;
      for (let k = Math.max(0, i - 4); k < i; k++) {
        if (_TRUST_SUP_NEGS.has(toks[k])) { neg = true; break; }
      }
      if (!neg) return true;
    }
  }
  for (const sToks of _TRUST_SUP_MULTI_N) {
    const n = sToks.length;
    for (let i = 0; i <= toks.length - n; i++) {
      if (!sToks.every((st, j) => tokenMatchesKw(toks[i + j], st))) continue;
      let neg = false;
      for (let k = Math.max(0, i - 4); k < i; k++) {
        if (_TRUST_SUP_NEGS.has(toks[k])) { neg = true; break; }
      }
      if (!neg) return true;
    }
  }
  return false;
}

function _trustHasNarrativeHandover(toks) {
  for (const kwToks of _ENTR_HANDOVER_KW) {
    const n = kwToks.length;
    for (let i = 0; i <= toks.length - n; i++) {
      if (!kwToks.every((kt, j) => tokenMatchesKw(toks[i + j], kt))) continue;
      let inClaim = false;
      for (let k = Math.max(0, i - 4); k < i; k++) {
        if (_TRUST_CLAIM_N.some(cm => tokenMatchesKw(toks[k], cm))) { inClaim = true; break; }
      }
      if (!inClaim) return true;
    }
  }
  return false;
}

/** factsMatchTrustDenial — returns "supported" | "bare" | null.
 *  null  → no denial marker found.
 *  "supported" → denial present + un-negated support evidence OR narrative (non-claim) handover.
 *  "bare" → denial present, handover only inside a claim, no un-negated support.
 *  Negated support («لا يوجد إيصال», «بلا شهود», «دون مستند») does NOT count.
 *  @param {string} facts @returns {"supported"|"bare"|null} */
export function factsMatchTrustDenial(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  if (!_trustHasDenial(toks)) return null;
  if (_trustHasUnnegatedSupport(toks)) return "supported";
  if (_trustHasNarrativeHandover(toks)) return "supported";
  return "bare";
}

// ── Trust non-return gate (Commit 50 addendum) ───────────────────────────────

// Handover/receipt verbs (group a) — reuse _ENTR_HANDOVER_KW plus أقرّ باستلامه variants.
const _TNR_HANDOVER_KW = [
  ..._ENTR_HANDOVER_KW,
  ...["أقرّ باستلامه", "أقر باستلامه", "أقرّ باستلامها", "أقر باستلامها", "أقرّ باستلام", "أقر باستلام"]
    .map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean)),
];

// Non-return / withholding / denial phrases and single tokens (group b).
// No negation guard: negators are already part of the phrases (لم يرد) or absent for single-token markers.
const _TNR_NONRETURN_KW = [
  "لم يرد", "لم يرده", "لم يردها", "لم يردا",
  "لم يعد", "لم يُعد", "لم يعيد", "لم يعيدا",
  "لم يسلّم", "لم يسلم",
  "ما رجّع", "ما رجع",
  "رفض ردّه", "رفض رده", "رفض ردها", "رفض إرجاع", "رفض الرد",
  "امتنع عن رد", "امتنع عن الرد",
  "أنكر استلام", "أنكر استلامه", "أنكر استلامها", "أنكر الاستلام",
  "ينكر أنه استلم", "نفى استلام",
  "جحد", "ينكر", "انكر",
  // Spend / disposal verbs that imply non-return (for T6: استخدمه)
  "استخدم", "صرف", "أنفق", "بدد", "تصرف", "باع", "استولى", "اختلس",
];

/** Returns true when facts contain both:
 *  (a) an un-negated handover or receipt (negator within 2 tokens before cancels it), AND
 *  (b) a non-return / withholding / denial phrase or spend/disposal verb.
 *  Purpose words are NOT required; the Commit 50 block already gates on the LLM saying خيانة الأمانة.
 *  @param {string} facts @returns {boolean} */
export function factsMatchTrustNonReturn(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // Group (a): handover/receipt with 2-token look-back negation guard
  let handoverFound = false;
  phraseLoop: for (const kwToks of _TNR_HANDOVER_KW) {
    const n = kwToks.length;
    posLoop: for (let i = 0; i <= toks.length - n; i++) {
      if (!kwToks.every((kt, j) => tokenMatchesKw(toks[i + j], kt))) continue;
      for (let k = Math.max(0, i - 2); k < i; k++) {
        if (_ENTR_NEGATORS.has(toks[k])) continue posLoop;
      }
      handoverFound = true;
      break phraseLoop;
    }
  }
  if (!handoverFound) return false;

  // Group (b): non-return / disposal (no negation guard)
  return factsMatchKeywords(facts, _TNR_NONRETURN_KW);
}

// ── Cheque-dishonour gate (Commit 48) ─────────────────────────────────────────

// Cheque noun tokens (after normalizeForKwMatch; tashkeel + tanwin stripped, ة→ه)
const _CHQ_NOUN_TOKS = new Set(["شيك", "شيكا", "الشيك", "صك", "صكا", "الصك"]);

// Single-token return verbs — subject to 1-token look-back negation guard.
// "اعاد" catches أعاد/فأعاده/وأعاده via rules 3 and 6.
const _CHQ_RET_SINGLE = ["ارتد", "اعيد", "رجع", "رفض", "مردود", "مرتد", "مرتجع", "اعاد"];

// Multi-token return phrases — NOT subject to the single-token negation guard
// because the negator is part of the phrase (لم يُصرف) or absent.
const _CHQ_RET_MULTI = [
  ["رفض", "البنك"],
  ["لم", "يصرف"],
];

// Negation guard: these tokens directly before a single-token return verb negate it.
const _CHQ_RET_NEG = new Set(["لم", "ما", "لا", "دون", "بدون", "غير"].map(normalizeForKwMatch));

// Balance-reason keywords — insufficient-balance or non-withdrawable-balance signals.
// No-account phrases (لا يوجد حساب / حساب مغلق) are intentionally absent — branch (a)
// is not this gate; their absence means only-no-account → null naturally.
const _CHQ_BALANCE_KW = [
  "عدم كفاية الرصيد",
  "لعدم كفاية الرصيد",
  "رصيد غير كافٍ",
  "رصيد غير كاف",
  "لا يوجد رصيد كافٍ",
  "لا يوجد رصيد كاف",
  "لعدم وجود رصيد",
  "بدون رصيد",
  "الرصيد غير قابل للسحب",
  "عدم قابلية الرصيد للسحب",
  "لا يمكن سحبه",
  "رصيد مجمّد",
  "رصيد مجمد",
];

// Stop-payment-order keywords.
const _CHQ_STOP_KW = [
  "أمر بإيقاف الصرف",
  "أمر بوقف الصرف",
  "إيقاف الصرف",
  "وقف الصرف",
  "أوقف الصرف",
  "أمر بإيقاف صرفه",
  "أمر سابق بإيقاف",
  "وقف صرف",    // matches "بوقف صرف الشيك" via ب-prefix rule
  "إيقاف صرف",  // matches "بإيقاف صرف …" via ب-prefix rule
];

/** Returns "balance" when the cheque was returned for insufficient/frozen balance,
 *  "stop" when returned due to a stop-payment order, or null when no recognisable
 *  dishonour pattern is found.  Fires only when ALL THREE conditions hold:
 *  (i) a cheque noun is present, (ii) an actual return by the bank occurs within a
 *  12-token window of the noun (with negation guard), (iii) a return reason is present.
 *  If both balance and stop reasons appear, "stop" is returned (more specific).
 *  @param {string} facts @returns {"balance"|"stop"|null} */
export function factsMatchChequeDishonour(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // (i) Locate cheque noun positions
  const chqPos = [];
  for (let i = 0; i < toks.length; i++) {
    if (_CHQ_NOUN_TOKS.has(toks[i])) chqPos.push(i);
  }
  if (chqPos.length === 0) return null;

  // (ii) Find an actual return signal within 12 tokens of any cheque noun
  let returnFound = false;
  outer:
  for (const cp of chqPos) {
    const lo = Math.max(0, cp - 12);
    const hi = Math.min(toks.length - 1, cp + 12);

    for (let i = lo; i <= hi; i++) {
      // Single-token return verb with negation guard
      if (_CHQ_RET_SINGLE.some(rv => tokenMatchesKw(toks[i], rv))) {
        if (i > 0 && _CHQ_RET_NEG.has(toks[i - 1])) continue;
        returnFound = true;
        break outer;
      }
    }
    // Multi-token return phrases (no single-negation guard)
    for (const ph of _CHQ_RET_MULTI) {
      for (let i = lo; i <= Math.min(hi, toks.length - ph.length); i++) {
        if (ph.every((kt, j) => tokenMatchesKw(toks[i + j], kt))) {
          returnFound = true;
          break outer;
        }
      }
    }
  }
  if (!returnFound) return null;

  // (iii) Check return reason
  const hasBalance = factsMatchKeywords(facts, _CHQ_BALANCE_KW);
  const hasStop    = factsMatchKeywords(facts, _CHQ_STOP_KW);
  if (!hasBalance && !hasStop) return null;
  // Both present → "stop" is more specific (lawyer rule)
  if (hasStop) return "stop";
  return "balance";
}

// ── Cheque balance-claim detector (Commit 48) ─────────────────────────────────

// Phrases the drawer uses to claim the balance was adequate or knowledge was absent.
// These phrases contain negators by design — NO negation guard is applied.
const _CHQ_BAL_CLAIM_KW = [
  "الرصيد كان كافياً",
  "الرصيد كان كافيا",
  "كان رصيده كافياً",
  "كان رصيده كافيا",
  "كان يحتوي على المبلغ",
  "كان الرصيد موجوداً",
  "كان الرصيد موجودا",
  "الرصيد كان موجوداً",
  "الرصيد كان موجودا",
  "أثبت بكشف حساب",
  "كشف حساب",
  "لم يكن يعلم",
  "لم يعلم بنقص",
  "لا يعلم بنقص",
  "ما كان عارف",
  "خصم البنك دون إخطاره",
  "خصم المبلغ دون إخطار",
  "دون إخطاره",   // catches "خصم رسوماً دون إخطاره"
  "دون إخطار",
  "سحب تحويلاً متوقعاً",
  "سحب تحويلا متوقعا",
];

/** Returns true when facts contain the drawer's defence for a balance-return case:
 *  a claim that the balance was adequate, or denial of knowledge of insufficiency.
 *  No negation guard — negated knowledge IS the claim.
 *  @param {string} facts @returns {boolean} */
export function factsMatchChequeBalanceClaim(facts) {
  if (factsMatchKeywords(facts, _CHQ_BAL_CLAIM_KW)) return true;
  // "أنكر [subject] علمه" — subject may intervene within 5 tokens
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    if (!tokenMatchesKw(toks[i], "انكر")) continue;
    for (let j = i + 1; j <= Math.min(i + 5, toks.length - 1); j++) {
      if (tokenMatchesKw(toks[j], "علم") || tokenMatchesKw(toks[j], "معرفه")) return true;
    }
  }
  return false;
}

// ── Cheque stop-cause detector (Commit 48) ────────────────────────────────────

// Phrases asserting a legitimate cause for the stop-payment order.
// Notice to the payee alone (أبلغ المستفيد) is intentionally absent — lawyer rule:
// notice alone is not a cause.
const _CHQ_STOP_CAUSE_KW = [
  "اكتشف عيباً",
  "اكتشف عيبا",
  "عيباً جوهرياً",
  "عيبا جوهريا",
  "عيب جوهري",
  "عيب في",
  "لم يتسلم البضاعة",
  "لم تُسلَّم البضاعة",
  "لم تسلم البضاعه",
  "لم ينفذ التزامه",
  "لم يُنفَّذ الالتزام",
  "لم ينفذ الالتزام",
  "نزاع على العقد",
  "نزاع حول العقد",
  "خلاف على العقد",
  "خلاف حول الصفقة",
  "خلاف حول الصفقه",
  "البضاعة مخالفة",
  "البضاعه مخالفه",
  "غش في المبيع",
];

/** Returns true when facts contain a drawer-asserted cause for a stop-payment order:
 *  defect, non-delivery, non-performance, or contractual dispute.
 *  Notice to the payee alone is NOT a cause (lawyer rule) and is excluded.
 *  @param {string} facts @returns {boolean} */
export function factsMatchChequeStopCause(facts) {
  return factsMatchKeywords(facts, _CHQ_STOP_CAUSE_KW);
}

// ── Document-alteration detector (Commit 49) ─────────────────────────────────

// Single-token base forms — tokenMatchesKw handles suffixes, articles, و/ف prefix.
// "إضافة" is alongside "أضاف" to catch "بإضافة" (ب-prefixed masdar).
const _ALT_VERB_SINGLE_KW = [
  "ملأ", "ملء", "أكمل", "أضاف", "إضافة", "شطب", "عدّل", "غيّر", "بدّل",
].map(normalizeForKwMatch);

// Multi-token phrases: position i matches when tokens[i] and tokens[i+1] both match.
const _ALT_VERB_MULTI_KW = [
  ["كتب",   "مبلغ"],
  ["أثبت",  "مبلغ"],
  ["زاد",   "المبلغ"],
  ["رفع",   "المبلغ"],
  ["حرّر",  "بمبلغ"],
  ["عدّل",  "التاريخ"],
  ["غيّر",  "التاريخ"],
  ["أضاف",  "بنداً"],
].map(pair => pair.map(normalizeForKwMatch));

// A negator token directly before an alteration verb cancels that one occurrence.
// Denial verbs (ينكر/أنكر/نفى) are NOT negators.
const _ALT_NEGATORS = new Set(
  ["لم", "ما", "لا", "دون", "بدون", "غير"].map(normalizeForKwMatch)
);

// Document nouns that ground the forgery — محرر/المحرر covers signed instruments.
const _DOC_NOUN_KW = [
  "شيك", "شيكاً", "صك", "عقد", "مستند", "محرر", "إيصال", "سند",
  "وثيقة", "استمارة", "كمبيالة", "إقرار", "فاتورة",
].map(normalizeForKwMatch);

// Authorization-dispute phrases — ANY one match anywhere in facts satisfies cond 3.
const _ALT_AUTH_DISPUTE_KW = [
  "أُذن له", "أذن له",
  "الإذن كان محدداً",
  "يؤكد أن الإذن",
  "يدعي موافقة شفوية",
  "موافقة شفوية",
  "تجاوز التفويض",
  "تجاوز الإذن",
  "دون إذنه", "دون إذن",
  "بغير إذن",
  "بلا إذن",
  "خلافاً للإذن",
  "لم يأذن",
  "ينكر أنه أذن",
  "سقف المبلغ",
  "بسقف",
];

/** Returns true when facts describe an authorization-disputed document alteration
 *  (Arts. 122/123). All three conditions must hold:
 *  (1) a document noun is present, (2) a non-negated alteration verb is within
 *  15 tokens of that noun, (3) an authorization-dispute phrase is anywhere in the facts.
 *  @param {string} facts @returns {boolean} */
export function factsMatchDocumentAlteration(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // Condition 1: find document noun positions.
  const docNounPositions = [];
  for (let i = 0; i < tokens.length; i++) {
    if (_DOC_NOUN_KW.some(k => tokenMatchesKw(tokens[i], k))) {
      docNounPositions.push(i);
    }
  }
  if (docNounPositions.length === 0) return false;

  // Condition 2: find non-negated alteration verb positions.
  const altVerbPositions = [];
  const seen = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const prevIsNeg = i > 0 && _ALT_NEGATORS.has(tokens[i - 1]);
    if (_ALT_VERB_SINGLE_KW.some(k => tokenMatchesKw(tokens[i], k))) {
      if (!prevIsNeg && !seen.has(i)) { altVerbPositions.push(i); seen.add(i); }
    }
    for (const [t0, t1] of _ALT_VERB_MULTI_KW) {
      if (
        i + 1 < tokens.length &&
        tokenMatchesKw(tokens[i], t0) &&
        tokenMatchesKw(tokens[i + 1], t1)
      ) {
        if (!prevIsNeg && !seen.has(i)) { altVerbPositions.push(i); seen.add(i); }
        break;
      }
    }
  }
  if (altVerbPositions.length === 0) return false;

  // Proximity: any (doc noun, alt verb) pair within 15 tokens of each other.
  let proximityMet = false;
  outer: for (const dp of docNounPositions) {
    for (const vp of altVerbPositions) {
      if (Math.abs(dp - vp) <= 15) { proximityMet = true; break outer; }
    }
  }
  if (!proximityMet) return false;

  // Condition 3: authorization-dispute phrase anywhere in facts.
  if (factsMatchKeywords(facts, _ALT_AUTH_DISPUTE_KW)) return true;

  // Special case: "لا تتجاوز" followed within 4 tokens by a number or amount word.
  const _AMOUNT_NORMS = ["مليون", "ملايين", "ألف", "آلاف", "جنيه", "ريال", "دولار"].map(normalizeForKwMatch);
  const LA_N  = normalizeForKwMatch("لا");
  const TAT_N = normalizeForKwMatch("تتجاوز");
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (tokenMatchesKw(tokens[i], LA_N) && tokenMatchesKw(tokens[i + 1], TAT_N)) {
      for (let j = i + 2; j <= Math.min(tokens.length - 1, i + 5); j++) {
        if (/^[0-9٠-٩]/.test(tokens[j]) || _AMOUNT_NORMS.some(a => tokenMatchesKw(tokens[j], a))) {
          return true;
        }
      }
    }
  }
  return false;
}

// ── Public-official false-entry detector (Commit 49) ─────────────────────────

// Extended official noun list (PUBLIC_OFFICIAL_KW + Art. 124-specific roles).
const _OFF124_KW_NORMS = [
  ...PUBLIC_OFFICIAL_KW,
  "مكلف بخدمة عامة",
  "المكلف بخدمة عامة",
  "كاتب",
  "مسجل",
  "المسجل",
  "محرر المحضر",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Private-sector markers: any present → not a public official.
const _PRIVATE_SECTOR_NORMS = [
  "موظف شركة", "موظف في شركة", "شركة خاصة", "موظف خاص", "موظف البنك",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Clerical-error exclusion phrases.
const _CLERICAL_ERROR_NORMS = [
  "خطأ كتابي", "خطأ مطبعي", "سهو", "خطأ في الكتابة",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Actor-binding exclusion: single-token markers near the official → not actor.
const _ACTOR_EXCL_SINGLE_NORMS = [
  "شهد", "شاهد", "اشتكى", "تسلم", "استلم",
].map(normalizeForKwMatch);
// Actor-binding exclusion: multi-token markers near the official → not actor.
const _ACTOR_EXCL_MULTI_NORMS = [
  ["تقدم", "ببلاغ"], ["سلم", "إلى"],
].map(pair => pair.map(normalizeForKwMatch));

// False-entry verbs (path i): أثبت، دوّن/دون، قيّد/قيد، سجّل/سجل، حرّر/حرر، كتب.
const _FENTRY_VERB_NORMS = [
  "أثبت", "دوّن", "قيّد", "سجّل", "حرّر", "كتب",
].map(normalizeForKwMatch);

// Falsity markers (false-entry path), including "لم يدلِ بها" as a 3-token phrase.
const _FALSITY_ENTRY_NORMS = [
  "خلاف الحقيقة", "على خلاف الحقيقة",
  "كاذبة", "كاذباً",
  "غير صحيحة",
  "لم تحدث",
  "وهمية", "مزورة",
  "لم يدل بها", "لم يدلِ بها",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Omission verbs (path ii): single-token.
const _OMIT_VERB_SINGLE_NORMS = ["أغفل", "أسقط", "حذف"].map(normalizeForKwMatch);
// Omission verbs (path ii): two-token negated forms (these ARE omission signals, not negators).
const _OMIT_VERB_NEG_NORMS = [
  ["لم", "يثبت"], ["لم", "يدوّن"], ["لم", "يقيّد"],
].map(pair => pair.map(normalizeForKwMatch));

// Truth markers for omission path.
const _TRUTH_MARKER_NORMS = [
  "واقعة صحيحة", "وقائع حقيقية", "بيانات صحيحة", "واقعة حقيقية",
  "أقوال", "ما أدلى به",
].map(kw => normalizeForKwMatch(kw).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean));

// Object nouns sufficient for omission path even without explicit truth marker.
const _OMIT_OBJ_NORMS = ["واقعة", "وقائع"].map(normalizeForKwMatch);

function _hasPhraseInWindow(tokens, start, end, phraseNorms) {
  for (let i = Math.max(0, start); i <= Math.min(tokens.length - 1, end); i++) {
    for (const phrase of phraseNorms) {
      if (phrase.length === 0) continue;
      if (i + phrase.length > tokens.length) continue;
      if (phrase.every((pt, j) => tokenMatchesKw(tokens[i + j], pt))) return true;
    }
  }
  return false;
}

/** Returns true when facts describe a public official making a false entry or
 *  omitting a true fact in an official record (Art. 124). Two independent paths:
 *  (i) false-entry: entry verb + official within 6 + falsity marker within 10 after;
 *  (ii) omission: omit verb + official within 6 + truth marker or واقعة within 8 after.
 *  Actor-binding, private-sector, and clerical-error exclusions apply.
 *  @param {string} facts @returns {boolean} */
export function factsMatchPublicOfficialFalseEntry(facts) {
  const tokens = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);

  // Private-sector exclusion: presence of any phrase → not a public official.
  if (_hasPhraseInWindow(tokens, 0, tokens.length - 1, _PRIVATE_SECTOR_NORMS)) return false;

  // Clerical-error exclusion when no separate falsity signal overrides it.
  if (_hasPhraseInWindow(tokens, 0, tokens.length - 1, _CLERICAL_ERROR_NORMS) &&
      !_hasPhraseInWindow(tokens, 0, tokens.length - 1, _FALSITY_ENTRY_NORMS)) return false;

  // Find official noun positions (start-of-phrase).
  const officialPositions = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const phrase of _OFF124_KW_NORMS) {
      if (phrase.length === 0) continue;
      if (i + phrase.length > tokens.length) continue;
      if (phrase.every((pt, j) => tokenMatchesKw(tokens[i + j], pt))) {
        officialPositions.push(i);
        break;
      }
    }
  }
  if (officialPositions.length === 0) return false;

  // Actor-binding: official must be subject of the verb (within 6 tokens bidirectionally)
  // and must not carry complainant/witness/recipient markers within 5 tokens of official.
  function officialIsActor(vp) {
    for (const op of officialPositions) {
      if (Math.abs(op - vp) > 6) continue;
      const lo = Math.max(0, op - 5);
      const hi = Math.min(tokens.length - 1, op + 5);
      let excluded = false;
      outer: for (let k = lo; k <= hi; k++) {
        if (_ACTOR_EXCL_SINGLE_NORMS.some(kw => tokenMatchesKw(tokens[k], kw))) {
          excluded = true; break;
        }
        for (const [t0, t1] of _ACTOR_EXCL_MULTI_NORMS) {
          if (k + 1 <= hi && tokenMatchesKw(tokens[k], t0) && tokenMatchesKw(tokens[k + 1], t1)) {
            excluded = true; break outer;
          }
        }
      }
      if (!excluded) return true;
    }
    return false;
  }

  // Collect false-entry verb positions.
  const fentryVerbPos = [];
  for (let i = 0; i < tokens.length; i++) {
    if (_FENTRY_VERB_NORMS.some(k => tokenMatchesKw(tokens[i], k))) fentryVerbPos.push(i);
  }

  // Collect omission verb positions (single-token + negated two-token forms).
  const omitVerbPos = [];
  const omitSeen = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (_OMIT_VERB_SINGLE_NORMS.some(k => tokenMatchesKw(tokens[i], k)) && !omitSeen.has(i)) {
      omitVerbPos.push(i); omitSeen.add(i);
    }
    for (const [t0, t1] of _OMIT_VERB_NEG_NORMS) {
      if (i + 1 < tokens.length &&
          tokenMatchesKw(tokens[i], t0) && tokenMatchesKw(tokens[i + 1], t1) &&
          !omitSeen.has(i)) {
        omitVerbPos.push(i); omitSeen.add(i); break;
      }
    }
  }

  if (fentryVerbPos.length === 0 && omitVerbPos.length === 0) return false;

  // Path (i): false-entry — verb + actor-bound official + falsity marker within 10 after.
  for (const vp of fentryVerbPos) {
    if (!officialIsActor(vp)) continue;
    if (_hasPhraseInWindow(tokens, vp + 1, vp + 10, _FALSITY_ENTRY_NORMS)) return true;
  }

  // Path (ii): omission — verb + actor-bound official + truth marker or واقعة/وقائع within 8 after.
  for (const vp of omitVerbPos) {
    if (!officialIsActor(vp)) continue;
    if (_hasPhraseInWindow(tokens, vp + 1, vp + 8, _TRUTH_MARKER_NORMS)) return true;
    for (let k = vp + 1; k <= Math.min(tokens.length - 1, vp + 8); k++) {
      if (_OMIT_OBJ_NORMS.some(kw => tokenMatchesKw(tokens[k], kw))) return true;
    }
  }

  return false;
}

// ── Admin appointment review gate (Commit 52) ──────────────────────────────

const _ADMIN_APPT_KW_NORMS =
  ["تعيين", "توظيف", "ترقية", "عين", "يعين", "وظف", "يوظف", "رقى", "يرقى"]
  .map(k => normalizeForKwMatch(k));

const _ADMIN_KIN_KW_NORMS =
  ["ابن", "بنت", "اخ", "اخت", "شقيق", "زوج", "قريب", "اقارب", "عم", "خال", "صهر", "حمو"];

const _ADMIN_IALAN_NEG_PH = [
  "دون إعلان", "بلا إعلان", "بغير إعلان", "بدون إعلان",
  "من غير إعلان", "عدم الإعلان", "عدم إعلان",
  "لم يعلن", "لم يُعلن", "لم يجر إعلان", "لم يتم إعلان",
];
const _ADMIN_MNFSA_NEG_PH = [
  "دون منافسة", "بلا منافسة", "بغير منافسة", "بدون منافسة",
  "من غير منافسة", "عدم المنافسة", "عدم منافسة",
  "لم تجر منافسة", "لم تكن منافسة",
];
const _ADMIN_MSABQ_NEG_PH = [
  "دون مسابقة", "بلا مسابقة", "بغير مسابقة", "بدون مسابقة",
  "من غير مسابقة", "عدم المسابقة", "عدم مسابقة",
  "لم تجر مسابقة", "لم تكن مسابقة",
];

const _ADMIN_IALAN_AFF_PH = [
  "جرى إعلان", "جري إعلان", "جرى الإعلان", "جري الإعلان",
  "تم الإعلان", "تم إعلان", "أعلن عن", "أُعلن عن", "اعلن عن",
  "إعلان رسمي", "الإعلان الرسمي",
];
const _ADMIN_MNFSA_AFF_PH = [
  "جرت منافسة", "جري منافسة", "أجريت منافسة", "اجريت منافسة", "تمت منافسة",
];
const _ADMIN_MSABQ_AFF_PH = [
  "جرت مسابقة", "جري مسابقة", "أجريت مسابقة", "اجريت مسابقة", "تمت مسابقة",
];

/**
 * Returns "fires" when the facts describe an appointment/employment/promotion
 * act for a relative of the decision-maker and explicitly negate a required
 * procedure (إعلان / منافسة / مسابقة).
 * Returns "conflict" when the same procedure is both affirmed and negated.
 * Returns null when the pattern is absent.
 */
export function factsMatchAdminAppointmentReview(facts) {
  const toks = normalizeForKwMatch(facts).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const n = toks.length;

  // Group (a): appointment / employment / promotion keyword
  const apptPos = [];
  for (let i = 0; i < n; i++) {
    if (_ADMIN_APPT_KW_NORMS.some(kw => tokenMatchesKw(toks[i], kw))) apptPos.push(i);
  }
  if (apptPos.length === 0) return null;

  // Group (b): kinship word within ±5 tokens of an appointment act
  let kinFound = false;
  outer:
  for (const ap of apptPos) {
    const lo = Math.max(0, ap - 5);
    const hi = Math.min(n - 1, ap + 5);
    for (let i = lo; i <= hi; i++) {
      if (_ADMIN_KIN_KW_NORMS.some(kw => tokenMatchesKw(toks[i], kw))) {
        kinFound = true;
        break outer;
      }
    }
  }
  if (!kinFound) return null;

  // Group (c): explicit negation of a procedure
  const iilanNeg = factsMatchKeywords(facts, _ADMIN_IALAN_NEG_PH);
  const mnfsaNeg = factsMatchKeywords(facts, _ADMIN_MNFSA_NEG_PH);
  const msabqNeg = factsMatchKeywords(facts, _ADMIN_MSABQ_NEG_PH);
  if (!iilanNeg && !mnfsaNeg && !msabqNeg) return null;

  // Conflict: the SAME procedure is both negated and affirmed in the facts
  const iilanAff = iilanNeg && factsMatchKeywords(facts, _ADMIN_IALAN_AFF_PH);
  const mnfsaAff = mnfsaNeg && factsMatchKeywords(facts, _ADMIN_MNFSA_AFF_PH);
  const msabqAff = msabqNeg && factsMatchKeywords(facts, _ADMIN_MSABQ_AFF_PH);
  if (iilanAff || mnfsaAff || msabqAff) return "conflict";

  return "fires";
}

// ── Qadhf gate (case 7 fix) ──────────────────────────────────────────────────
// Art. 157 (hadd qadhf) covers ONLY an imputation of zina, liwat or denial of
// lineage. An insult such as "حرامي" (thief) is never qadhf; it belongs to
// Arts. 159/160. The LLM sometimes returns "قذف" for any public insult, so the
// engine keeps Art. 157 only when the facts themselves carry such an imputation.

/** Zina / liwat words (single tokens; matched with the usual prefix/suffix rules). */
export const QADHF_IMPUTATION_KW = [
  "زاني", "زانيه", "زنا", "زني", "زنت", "يزني", "تزني", "زنيت",
  "لواط", "لوطي", "يلوط", "لاط",
  "عاهره", "شرموطه", "قحبه", "مومس",
  "ابن زنا", "ولد زنا", "بنت زنا", "بت زنا",
];

/** Denial-of-lineage phrases, matched on whole normalised tokens only so that
 * "حرامي" (thief) never matches "حرام". */
const QADHF_NASAB_RE = new RegExp(
  "(?:^|\\s)(?:ولد|ابن|بنت|بت|اولاد|ابناء|عيال)\\s+(?:ال)?حرام(?=\\s|$)" +
  "|نفي\\s+(?:ال)?نسب|نفي\\s+نسبه|نفي\\s+نسبها" +
  "|(?:ليس|ما|مش|ماهو|ما\\s+هو)\\s+(?:ولده|ابنه|ولدو|بنته|بتو)(?=\\s|$)" +
  "|(?:ليست|ما|مش|ماهي|ما\\s+هي)\\s+(?:بنته|ابنته|بتو)(?=\\s|$)",
);

/**
 * True when the facts impute zina, liwat, or deny lineage — the only
 * imputations Art. 157 covers.
 * @param {string} facts @returns {boolean}
 */
export function factsMatchQadhfImputation(facts) {
  if (factsMatchKeywords(facts, QADHF_IMPUTATION_KW)) return true;
  const norm = " " + normalizeForKwMatch(facts).replace(/[^؀-ۿA-Za-z0-9]+/g, " ").trim() + " ";
  return QADHF_NASAB_RE.test(norm);
}

// ── Blunt instrument wound gate (case 3 fix) ─────────────────────────────────
// A blow with a stick/cane/stone that opened a wound does not settle intent:
// the wound may be عمد (Art. 139) or شبه عمد (Art. 140) depending on intent,
// the spot struck and the force. Unless the facts state intent, the engine
// shows Art. 138 and leaves the description as an open point.

const _BLUNT_INSTRUMENT_KW = [
  "عكاز", "عكازه", "عصا", "عصايه", "عصاي", "سوط", "كرباج", "خشبه", "حجر", "طوبه",
];
const _IRON_ROD_KW = ["عصا حديديه", "عصا حديد", "سيخ", "ماسوره"];
const _STATED_INTENT_KW = ["قاصد", "قاصدا", "متعمد", "متعمدا", "عمدا", "تعمد", "بقصد", "قصد", "ناوي", "داير"];

/** True when the blow came from a blunt, non-lethal instrument. @param {string} facts */
export function factsMatchBluntInstrument(facts) {
  return factsMatchKeywords(facts, _BLUNT_INSTRUMENT_KW) && !factsMatchKeywords(facts, _IRON_ROD_KW);
}

/** True when the facts state intent (or deny it) in words. @param {string} facts */
export function factsStateIntentWords(facts) {
  return factsMatchKeywords(facts, _STATED_INTENT_KW);
}

// ── Hit-and-run markers (case 8 fix) ─────────────────────────────────────────
// Traffic Act 2010, Art. 60: fleeing after a traffic accident, or failing to aid
// the injured, is a separate offence added to the accident itself.
const _HIT_AND_RUN_KW = [
  "هرب", "هربت", "فر", "فرت", "شرد", "اختفى", "لاذ بالفرار",
  "ما وقف", "لم يقف", "لم يتوقف", "ما اتوقف",
  "دون اسعاف", "دون إسعافه", "دون إسعافها", "دون إسعاف", "بدون اسعاف",
  "لم يسعف", "ما اسعف", "ما أسعف", "ترك المصاب", "تركه ينزف", "تركها تنزف",
];

/** True when the facts say the driver fled or did not aid the injured. @param {string} facts */
export function factsMatchHitAndRun(facts) {
  return factsMatchKeywords(facts, _HIT_AND_RUN_KW);
}

// ── Double sale (case 5 fix) ─────────────────────────────────────────────────
// Selling the same thing to two buyers and taking both prices may be fraud
// (Art. 178) if deception and bad intent are proved; it is also a civil dispute
// over ownership. Detects the sale verb plus a "to two people / twice" marker.
const _SALE_VERB_KW = ["باع", "باعت", "باعه", "باعها", "بيع"];
const _TWO_BUYERS_KW = [
  "لشخصين", "لاثنين", "لإتنين", "لاتنين", "مرتين", "لأكثر من شخص", "لاكثر من شخص",
  "لشخص آخر", "لشخص اخر", "لشخص تاني", "لزول تاني", "لزولين", "من الاثنين", "من الاتنين",
  "لمشتريين", "لمشتري آخر", "لمشتري تاني",
];

/** True when the facts describe one thing sold to two buyers. @param {string} facts */
export function factsMatchDoubleSale(facts) {
  return factsMatchKeywords(facts, _SALE_VERB_KW) && factsMatchKeywords(facts, _TWO_BUYERS_KW);
}

// Case 6: an employee taking money from the workplace or its clients. Opens the
// Unlawful and Suspicious Enrichment Act 1989 for research — never asserts it applies
// (public-employee status and the Act's force are for the lawyer to establish).
const _EMPLOYEE_KW = [
  "موظف", "موظفة", "موظفين", "مدير", "محاسب", "محاسبة", "صراف", "صرافة", "أمين خزينة", "امين خزينة",
  "أمين الخزينة", "امين الخزنة", "مسؤول مالي", "مسئول مالي", "كاشير",
];
const _TOOK_MONEY_KW = [
  "حوّل مبالغ", "حول مبالغ", "حوّل أموال", "حول اموال", "حوّل أموال", "حول أموال",
  "اختلس", "اختلاس", "استولى على", "استولي علي", "استولى علي",
  "أخذ مبالغ", "اخذ مبالغ", "أخذ أموال", "اخذ اموال", "من الخزنة", "من الخزينة",
  "من حسابات", "إلى حسابه", "الى حسابه", "لحسابه", "إلى حسابها", "الى حسابها", "لحسابها",
  "قروش الشركة", "قروش الشغل", "مال الشركة", "أموال الشركة", "اموال الشركة", "المال العام",
];

/** True when the facts describe an employee taking money from work or its clients. @param {string} facts */
export function factsMatchEmployeeTookMoney(facts) {
  return factsMatchKeywords(facts, _EMPLOYEE_KW) && factsMatchKeywords(facts, _TOOK_MONEY_KW);
}
