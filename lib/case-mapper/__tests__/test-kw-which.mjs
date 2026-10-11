// Section C — whichLethalMethod label/null verification.
import { whichLethalMethod } from "../kw-matcher.mjs";

// [text, expected_label_or_null, note]
const tests = [
  // ── Returns method label ────────────────────────────────────────────────────
  ["خنق الجاني ضحيته حتى فقدت وعيها.",                "خنق",   "خنق group → label خنق"],
  ["وضع السم في كأسها.",                               "سم",    "السم → label سم"],
  ["سقاه سماً في طعامه.",                              "سم",    "سماً → label سم"],
  ["سمّم الجاني الطعام.",                               "سم",    "سمّم → label سم"],
  ["أحرق منزله وهو نائم فيه.",                          "حرق",   "أحرق → label حرق"],
  ["سكب البنزين على ملابسه وأشعل فيها النار.",           "حرق",   "سكب البنزين → label حرق"],
  ["أغرق الجاني الطفل في النهر.",                       "إغراق", "أغرق → label إغراق"],
  ["ذبح الجاني المجني عليه بسكين.",                     "ذبح",   "ذبح → label ذبح"],
  ["نحر الجاني ضحيته.",                                 "ذبح",   "نحر → label ذبح"],
  ["وضعت مادة سامة في كوب العصير.",                      "سم",    "مادة سامة → label سم"],
  ["أثبت التحليل وجود المادة السامة في العينة.",         "سم",    "المادة السامة (definite) → label سم"],
  // ── Returns null (no lethal method) ────────────────────────────────────────
  ["ضربه بعصا على رأسه.",                               null,    "stick — no lethal method"],
  ["طعنه بسكين في بطنه.",                               null,    "stab — طعن is weapon not method"],
  ["لكمه في وجهه.",                                     null,    "punch — no lethal method"],
  ["أطلق عليه النار.",                                  null,    "shooting — weapon not method group"],
];

let allPassed = true;
console.log("whichLethalMethod label/null\n" + "─".repeat(72));
for (const [text, expected, note] of tests) {
  const got = whichLethalMethod(text);
  const ok  = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} expected=${JSON.stringify(expected)} got=${JSON.stringify(got)}  "${text}"  (${note})`);
}
console.log("─".repeat(72));
console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
process.exit(allPassed ? 0 : 1);
