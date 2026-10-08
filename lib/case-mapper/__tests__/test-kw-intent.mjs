// Commits 13/14 — factsMatchIntentToKill: explicit stated intent, premeditation,
// prior threat, and negation guard.
// Run with: node lib/case-mapper/__tests__/test-kw-intent.mjs
import { factsMatchIntentToKill } from "../kw-matcher.mjs";

const tests = [
  // ── FIRE: explicit intent phrases (Commit 13) ─────────────────────────────
  { input: "ضرب المتهم المجني عليه بعصا على رأسه بقصد قتله فتوفي.",             expected: true,  note: "بقصد قتله" },
  { input: "طعنه بسكين بقصد قتلها فماتت.",                                      expected: true,  note: "بقصد قتلها" },
  { input: "أطلق عليهم النار بقصد قتلهم.",                                       expected: true,  note: "بقصد قتلهم" },
  { input: "ضربه بعصا قاصداً قتله فتوفي.",                                       expected: true,  note: "قاصداً قتله" },
  { input: "طعنته بنية قتله.",                                                   expected: true,  note: "بنية قتله" },
  { input: "اعتدى عليها وأراد قتلها.",                                           expected: true,  note: "أراد قتلها" },
  { input: "كان يريد قتله منذ زمن.",                                             expected: true,  note: "يريد قتله" },
  { input: "نوى قتله قبل الحادثة.",                                              expected: true,  note: "نوى قتله" },
  // ── FIRE: premeditation phrases (Commit 14) ───────────────────────────────
  { input: "قتله مع سبق الإصرار.",                                               expected: true,  note: "مع سبق الإصرار" },
  { input: "جريمة سبق الإصرار والترصد.",                                         expected: true,  note: "سبق الإصرار والترصد" },
  { input: "ترصد له حتى خرج ثم ضربه فتوفي.",                                    expected: true,  note: "ترصد له" },
  { input: "تربص به عدة أيام ثم نفّذ الجريمة.",                                  expected: true,  note: "تربص به" },
  // ── FIRE: prior-threat proximity check (Commit 14) ────────────────────────
  { input: "توعده بالقتل ثم ضربه بعصا فتوفي.",                                  expected: true,  note: "توعده بالقتل — direct phrase" },
  { input: "توعد المتهم المجني عليه بالقتل، ثم ضربه بعصا على رأسه فتوفي.",     expected: true,  note: "توعد...بالقتل — proximity (3 intervening tokens)" },
  { input: "هدده بالقتل قبل يوم من الحادثة.",                                   expected: true,  note: "هدده بالقتل" },
  // ── NO-FIRE: negation guard (Commit 14) ───────────────────────────────────
  { input: "ضربه بعصا على رأسه ولم يكن ذلك بقصد قتله فتوفي.",                  expected: false, note: "ولم...بقصد قتله — negator 'لم' (with و prefix) precedes phrase" },
  { input: "ضربه بعصا فتوفي، ونفى المتهم أنه أراد قتله.",                       expected: false, note: "نفى...أراد قتله — denial verb precedes phrase" },
  { input: "ضربه بعصا فتوفي، وأنكر المتهم أنه كان قاصداً قتله.",               expected: false, note: "أنكر...قاصداً قتله — denial verb precedes phrase" },
  // ── NO-FIRE: negated or absent intent (Commit 13) ────────────────────────
  { input: "ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي.",          expected: false, note: "دون قصد قتله — no KILL_INTENT_KW phrase present" },
  { input: "دفعه أثناء مشاجرة ولم يقصد القتل فسقط وتوفي.",                     expected: false, note: "ولم يقصد القتل — bare phrase not in KILL_INTENT_KW" },
  { input: "نفى المتهم قصد القتل.",                                              expected: false, note: "bare قصد القتل — excluded (matches negated forms)" },
  { input: "لكم المتهم المجني عليه بيده فتوفي.",                                 expected: false, note: "no intent phrase" },
  { input: "خنق المتهم زوجته حتى فارقت الحياة.",                                expected: false, note: "strangulation — no KILL_INTENT_KW phrase (method only)" },
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
