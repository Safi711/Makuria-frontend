// Commit 13 — factsMatchIntentToKill: explicit stated intent to kill.
// Run with: node lib/case-mapper/__tests__/test-kw-intent.mjs
import { factsMatchIntentToKill } from "../kw-matcher.mjs";

const tests = [
  // ── FIRE: explicit stated intent phrases ──────────────────────────────────
  { input: "ضرب المتهم المجني عليه بعصا على رأسه بقصد قتله فتوفي.",             expected: true,  note: "بقصد قتله" },
  { input: "طعنه بسكين بقصد قتلها فماتت.",                                      expected: true,  note: "بقصد قتلها" },
  { input: "أطلق عليهم النار بقصد قتلهم.",                                       expected: true,  note: "بقصد قتلهم" },
  { input: "ضربه بعصا قاصداً قتله فتوفي.",                                       expected: true,  note: "قاصداً قتله" },
  { input: "طعنته بنية قتله.",                                                   expected: true,  note: "بنية قتله" },
  { input: "اعتدى عليها وأراد قتلها.",                                           expected: true,  note: "أراد قتلها" },
  { input: "كان يريد قتله منذ زمن.",                                             expected: true,  note: "يريد قتله" },
  { input: "نوى قتله قبل الحادثة.",                                              expected: true,  note: "نوى قتله" },
  // ── NO-FIRE: negated or absent intent ────────────────────────────────────
  { input: "ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي.",          expected: false, note: "دون قصد قتله — negated (no KILL_INTENT_KW phrase)" },
  { input: "دفعه أثناء مشاجرة ولم يقصد القتل فسقط وتوفي.",                     expected: false, note: "ولم يقصد القتل — negated bare phrase" },
  { input: "نفى المتهم قصد القتل.",                                              expected: false, note: "bare قصد القتل — excluded to avoid matching negated forms" },
  { input: "لكم المتهم المجني عليه بيده فتوفي.",                                 expected: false, note: "no intent phrase" },
  { input: "خنق المتهم زوجته حتى فارقت الحياة.",                                expected: false, note: "strangulation — no explicit intent phrase in KILL_INTENT_KW" },
];

let allPassed = true;
console.log("Intent-to-kill gate — " + tests.length + "-row test\n" + "─".repeat(70));
for (const { input, expected, note } of tests) {
  const got = factsMatchIntentToKill(input);
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
