// Commit 12 — factsMatchWound: confirms physical wound in facts text.
// Run with: node lib/case-mapper/__tests__/test-kw-wound.mjs
import { factsMatchWound } from "../kw-matcher.mjs";

const tests = [
  // ── FIRE: wound words present ──────────────────────────────────────────────
  { input: "طعن المتهم الحارس بسكين فجرحه في يده وأخذ منه الهاتف.",               expected: true,  note: "جرحه — جرح+ه suffix" },
  { input: "ضرب المتهم الحارس بعصا فأحدث به جرحاً في رأسه ونهب الخزنة.",           expected: true,  note: "جرحاً — جرح+ا tanwin" },
  { input: "اعتدى المتهمان على سائق الركشة وشجّا رأسه بحجر وأخذا الركشة.",        expected: true,  note: "شجّا — شج+ا verb ending" },
  { input: "خطف المتهم الهاتف من يد المجني عليها فسقطت وكُسرت يدها.",              expected: true,  note: "كُسرت — كسر+ت verb ending" },
  { input: "أصيب المجني عليه بجروح بالغة.",                                        expected: true,  note: "جروح — plural keyword" },
  { input: "وجدوا مجروحاً على الأرض.",                                              expected: true,  note: "مجروحاً — مجروح+ا" },
  { input: "سال نزيف من رأسه.",                                                     expected: true,  note: "نزيف exact" },
  { input: "غرز المتهم الإبرة في ذراعه.",                                           expected: true,  note: "غرز exact" },
  // ── NO-FIRE: no wound words ────────────────────────────────────────────────
  { input: "ضرب المتهم الحارس وأخذ منه الهاتف بالقوة.",                            expected: false, note: "ضرب only — no wound word" },
  { input: "دفع المتهم امرأة في الشارع فسقطت، ثم خطف حقيبتها وهرب.",              expected: false, note: "fall/snatch — no wound word" },
  { input: "هدد المتهم الحارس بسكين وأخذ الهاتف ولم يصبه بأذى.",                  expected: false, note: "weapon threat, no wound" },
  // negation case: wound word present but in negated clause — gate fires
  // (negation is handled by the LLM, not this keyword gate)
  { input: "ضرب المتهم الحارس وأخذ الهاتف ولم يحدث به جرحاً.",                    expected: true,  note: "negation — جرحاً present, gate fires; LLM handles negation upstream" },
  { input: "أشهر المتهم مسدساً في وجه الصراف وأخذ النقود دون أن يطلق النار.",      expected: false, note: "weapon brandished, no wound word" },
];

let allPassed = true;
console.log("Wound gate — " + tests.length + "-row test\n" + "─".repeat(70));
for (const { input, expected, note } of tests) {
  const got = factsMatchWound(input);
  const ok = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} ${note}`);
  if (!ok) {
    console.log(`  input:    ${input}`);
    console.log(`  expected: ${expected}`);
    console.log(`  got:      ${got}`);
  }
}
console.log("─".repeat(70));
console.log(allPassed ? "ALL PASSED" : "FAILURES");
process.exit(allPassed ? 0 : 1);
