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
