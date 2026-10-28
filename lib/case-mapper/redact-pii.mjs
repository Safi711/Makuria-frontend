/**
 * Strip personal identifiers from the facts before they leave our server.
 *
 * Applied in llm-classifier.ts to the ONE copy of the facts sent to the
 * external model (Anthropic). The local rule engine, the page and the share
 * links keep the visitor's text as typed. Decision: Safi, 2026-10-26 —
 * facts may go to a provider outside Sudan only with names and ID numbers
 * removed automatically.
 *
 * Deliberately conservative: it removes what is clearly an identifier and
 * leaves anything that could carry legal meaning — amounts of money, dates,
 * article and law numbers, ages, places ("سوق أم درمان").
 *
 * Run tests: node lib/case-mapper/__tests__/test-redact-pii.mjs
 */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

// A digit, Latin or Arabic-Indic.
const D = "[0-9٠-٩]";

// Words after a long number that mark it as money, not an identifier.
const CURRENCY_AFTER =
  /^\s*(?:ألف\s+|مليون\s+|مليار\s+)?(?:جنيه|جنيهاً|جنيها|جنية|ج\.?س|دولار|دولاراً|ريال|درهم|يورو|sdg|usd)/i;
// Words before a number that mark it as a law/article/case reference.
// Words before a number that mark it as money.
const MONEY_BEFORE = /(?:مبلغ|مبلغاً|مبلغا|بمبلغ|قيمة|بقيمة|ثمن|بثمن)\s*$/;
const REFERENCE_BEFORE = /(?:المادة|مادة|المواد|البند|الفقرة|قانون|لسنة|سنة|عام|رقم\s+القضية|م\s*ع|art\.?)\s*$/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// International or local phone numbers (Sudan +249 / 00249 / 0, and others):
// an optional + then 9–15 digits, allowing spaces, dots or dashes inside.
const LONG_NUMBER = new RegExp(`\\+?${D}(?:[\\s.\\-]?${D}){8,14}`, "g");

// Cues that introduce a person's name in Arabic legal narration.
const NAME_CUES = [
  "المدعو", "المدعوة", "المسمى", "المسماة", "يدعى", "يُدعى", "تدعى", "تُدعى",
  "اسمه", "اسمها", "واسمه", "واسمها", "السيد", "السيدة",
];
// Words that end a name: prepositions, relatives, common verbs and nouns.
const NAME_STOP = new Set([
  "في", "من", "على", "إلى", "الى", "عن", "مع", "ثم", "و", "أو", "او", "لكن", "حيث",
  "الذي", "التي", "الذين", "اللذين", "وهو", "وهي", "هو", "هي", "قد", "وقد", "لقد",
  "كان", "كانت", "قام", "قامت", "قال", "قالت", "بعد", "قبل", "عند", "منذ", "بتاريخ",
  "يوم", "يسكن", "تسكن", "يعمل", "تعمل", "المتهم", "المتهمة", "الشاكي", "الشاكية",
  "سرق", "سرقت", "ضرب", "ضربت", "أخذ", "أخذت", "باع", "باعت", "استلم", "استلمت",
  "رفض", "رفضت", "لم", "لا", "ما",
]);
const ARABIC_WORD = /^[\u0621-\u064A\u0660-\u0669\u0670-\u06D3\u0640ـ]+$/;

function redactNames(text) {
  // Tokenise on whitespace but keep the separators, so the text is rebuilt exactly.
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i++) {
    const cue = parts[i].replace(/[،,.:؛;]+$/, "");
    if (!NAME_CUES.includes(cue) || parts[i] !== cue) continue;
    let taken = 0;
    let j = i + 2; // skip the whitespace after the cue
    while (j < parts.length && taken < 3) {
      const raw = parts[j];
      const word = raw.replace(/[،,.:؛;!?؟)"»]+$/, "");
      if (!word || !ARABIC_WORD.test(word) || NAME_STOP.has(word)) break;
      const trailing = raw.slice(word.length);
      parts[j] = taken === 0 ? "[اسم]" + trailing : trailing;
      if (taken > 0) parts[j - 1] = ""; // drop the space between name parts
      taken++;
      if (trailing) break; // punctuation ends the name
      j += 2;
    }
  }
  return parts.join("");
}

/** Returns the text with identifiers replaced by neutral placeholders. */
export function redactPII(text) {
  if (!text) return text;
  let out = text.replace(EMAIL, "[بريد]");
  out = out.replace(LONG_NUMBER, (match, offset, whole) => {
    const before = whole.slice(Math.max(0, offset - 20), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 20);
    if (CURRENCY_AFTER.test(after) || MONEY_BEFORE.test(before) || REFERENCE_BEFORE.test(before)) return match;
    const digits = toLatinDigits(match).replace(/\D/g, "");
    if (digits.length < 9) return match;
    return "[رقم]";
  });
  return redactNames(out);
}
