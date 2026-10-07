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

/** Use this instead of factsMatchKeywords(facts, LETHAL_WEAPON_KW).
 * Identical except that a match coming solely from bare طعن/الطعن is
 * suppressed when it is a legal appeal (within-3-token proximity to
 * الحكم/القرار/الاستئناف/النقض/المحكمة).
 * @param {string} facts @returns {boolean} */
export function factsMatchLethalWeapon(facts) {
  if (!factsMatchKeywords(facts, LETHAL_WEAPON_KW)) return false;
  // Check if any keyword other than bare "طعن" (verb) already fires.
  const withoutVerb = LETHAL_WEAPON_KW.filter(k => normalizeForKwMatch(k) !== "طعن");
  if (factsMatchKeywords(facts, withoutVerb)) return true;
  // Only طعن fired — suppress if it is a legal-appeal context.
  return !isTaunLegalAppeal(facts);
}
