// Commit 14 — factsMatchLethalMethod: lethal-method gate.
// Run with: node lib/case-mapper/__tests__/test-kw-method.mjs
import { factsMatchLethalMethod } from "../kw-matcher.mjs";

const tests = [
  // ── FIRE: lethal method present ────────────────────────────────────────────
  { input: "خنق المتهم زوجته حتى فارقت الحياة.",                            expected: true,  note: "خنق exact" },
  { input: "خنقه بحبل حتى مات.",                                             expected: true,  note: "خنقه — خنق+ه suffix" },
  { input: "وضع المتهم السم في طعام المجني عليه فتوفي.",                     expected: true,  note: "السم — definite article" },
  { input: "دسّ السم في شرابه.",                                              expected: true,  note: "دسّ السم — two-token phrase" },
  { input: "سمّم المتهم المجني عليه.",                                       expected: true,  note: "سمّم (normalized: سمم)" },
  { input: "أفضى إلى وفاته بعد تسميمه.",                                     expected: true,  note: "تسميم masdar" },
  { input: "أحرق المتهم المجني عليه.",                                       expected: true,  note: "أحرق — حرق+ه via suffix" },
  { input: "سكب المتهم البنزين على المجني عليه وأشعل فيه النار فمات.",       expected: true,  note: "أشعل فيه النار — 3-token phrase (البنزين alone no longer fires)" },
  { input: "أغرق الطفل في النهر متعمداً.",                                   expected: true,  note: "أغرق — intentional drowning" },
  { input: "ذبح المتهم المجني عليه بسكين.",                                  expected: true,  note: "ذبح exact" },
  { input: "نحره أمام منزله.",                                               expected: true,  note: "نحر — نحر+ه suffix" },
  // ── NO-FIRE: accidental or unrelated context, and bare-fuel fix (Commit 16) ──
  { input: "تشاجرا في محطة البنزين فضربه بعصا على رأسه فتوفي.",              expected: false, note: "محطة البنزين — fuel-station context, no lethal method" },
  { input: "غرق الطفل في الترعة أثناء غياب والده.",                          expected: false, note: "غرق — accident, not أغرق" },
  { input: "ضرب المتهم المجني عليه بعصا على رأسه فتوفي بعد يومين.",          expected: false, note: "stick — no lethal method keyword" },
  { input: "لكم المتهم المجني عليه فسقط وتوفي.",                             expected: false, note: "punch — no lethal method keyword" },
  // NOTE: factsMatchLethalMethod("أحرق المتهم محصول جاره") returns TRUE —
  // أحرق is in LETHAL_METHOD_KW. The gate doesn't open for that fact set
  // because the LLM classifies it as arson (not قتل عمد/شبه عمد), so the
  // first gate condition fails. Test here reflects keyword function behavior.
  { input: "كتب اسمه على الورقة.",                                           expected: false, note: "اسم — name, not سم" },
];

let allPassed = true;
console.log("Lethal-method gate — " + tests.length + "-row test\n" + "─".repeat(70));
for (const { input, expected, note } of tests) {
  const got = factsMatchLethalMethod(input);
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
