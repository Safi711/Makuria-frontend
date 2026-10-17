// Section B — factsMatchDeliberateAssault fire/no-fire verification.
import { factsMatchDeliberateAssault } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── FIRE (deliberate assault keywords present) ──────────────────────────────
  ["ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي.",      true,  "ضرب → assault match"],
  ["لكم المتهم المجني عليه في وجهه فسقط على الرصيف ومات.",          true,  "لكم → assault match"],
  ["ركل الجاني المجني عليه في بطنه ثم فر.",                          true,  "ركل → assault match"],
  ["صفع المتهم المجني عليه أمام الجميع.",                            true,  "صفع → assault match"],
  ["طعنه بسكين في صدره ثم هرب.",                                    true,  "طعن → assault match"],
  ["اعتدى المتهم على جاره بالضرب.",                                  true,  "اعتدى → assault match"],
  ["هاجم المتهم المجني عليه في الشارع.",                             true,  "هاجم → assault match"],
  ["خنق الجاني ضحيته حتى فقدت وعيها.",                              true,  "خنق → assault match"],
  ["دفعه من على الدرج فسقط.",                                        true,  "دفعه → assault match"],
  ["رماه بحجر على رأسه.",                                            true,  "رماه → assault match"],
  // ── Conjunction prefix — C rows ─────────────────────────────────────────────
  ["تشاجرا فضربه على رأسه فتوفي",   true,  "C8  فضربه → ف+ضرب+ه → assault match"],
  ["أمسك به ولكمه في وجهه",          true,  "C9  ولكمه → و+لكم+ه → assault match"],
  ["أسقطه أرضاً وركله في بطنه",      true,  "C10 وركله → و+ركل+ه → assault match"],
  // ── C34 TRUE — tightened verbs with contextual evidence ────────────────────
  ["لكمه في وجهه",                                true,  "C11 لكمه → condition (a): pronoun ه"],
  ["ضربه بعصا",                                   true,  "C12 ضربه → condition (a): pronoun ه"],
  ["ضربوه ضرباً مبرحاً",                          true,  "C13 ضربوه → condition (a): verb-ending و + pronoun ه"],
  ["لكمات متتالية على وجهه",                      true,  "C14 لكمات → condition (d): verbal noun + وجهه ends in ه"],
  ["تشاجرا فضربه على رأسه فتوفي",                 true,  "C15 فضربه → condition (a): pronoun ه (see also C8)"],
  ["ركلها في بطنها",                              true,  "C16 ركلها → condition (a): pronoun ها"],
  ["صفع الطفل على وجهه",                          true,  "C17 صفع → condition (b): person word الطفل"],
  ["ضرب زوجته بالحزام",                           true,  "C18 ضرب → condition (b): person word زوجته"],
  ["أسقطه أرضاً وركله",                           true,  "C19 وركله → condition (a): pronoun ه, no next token"],
  ["اعتدى عليه بالضرب",                           true,  "C20 اعتدى → unchanged KW fires"],
  // ── C34 FALSE — idioms and non-person verbs now correctly suppressed ────────
  ["ولكم جزيل الشكر على حسن تعاونكم",             false, "F1  ولكم → و+لكم (pronoun), no obj-pronoun suffix → no fire"],
  ["وضربه المطر في الطريق فتأخر",                 false, "F2  وضربه → pronoun ه, BUT next = المطر (non-person) → no fire"],
  ["ضرب له موعداً ثم تشاجرا",                     false, "F3  ضرب → bare, no pronoun, no person, no instrument → no fire"],
  ["ضربت الكهرباء المنطقة",                       false, "F4  ضربت → suffix ت (not obj-pronoun), no person → no fire"],
  ["ضرب الرقم القياسي",                           false, "F5  ضرب → bare, الرقم not a person → no fire"],
  ["وركلة جزاء ثم تشاجرا",                        false, "F6  وركلة → origToken ends ة (taa marbuta), noun form → no fire"],
  ["ضرب مثلاً للحاضرين",                          false, "F7  ضرب → bare, مثلاً not a person or instrument → no fire"],
  ["لكم كل الحق في ذلك",                          false, "F8  لكم → exact match, no suffix, no person in next 4 → no fire"],
  // ── NO FIRE (stay-132 cases — negligence, accident, no assault) ────────────
  ["كان ينظف بندقيته فانطلقت منها رصاصة.",                          false, "accident — no assault keyword"],
  ["أهمل الطبيب تعقيم الأدوات فتوفي المريض.",                        false, "medical negligence — no assault keyword"],
  ["دفع المقاول أجور العمال ثم سقط الجدار على عامل.",               false, "دفع (money context) — no assault keyword"],
  ["سائق انشغل بهاتفه فصدم مشاة فتوفي.",                            false, "traffic negligence — no assault keyword"],
];

let allPassed = true;
console.log("factsMatchDeliberateAssault fire/no-fire\n" + "─".repeat(72));
for (const [text, expected, note] of tests) {
  const got = factsMatchDeliberateAssault(text);
  const ok  = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} [${expected ? "FIRE    " : "NO FIRE "}] got=${got}  "${text}"  (${note})`);
}
console.log("─".repeat(72));
console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
process.exit(allPassed ? 0 : 1);
