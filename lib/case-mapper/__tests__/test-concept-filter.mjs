// Commit 8 — concept-filter unit test.
// Rule: when جرح عمد is present, drop أذى; otherwise leave the list unchanged.
// Run with: node lib/case-mapper/__tests__/test-concept-filter.mjs
import { dropAthaIfWound } from "../kw-matcher.mjs";

const tests = [
  [["جرح عمد", "أذى", "جرح"], ["جرح عمد", "جرح"], "جرح عمد present → أذى dropped"],
  [["أذى"],                    ["أذى"],             "أذى alone → unchanged"],
  [["أذى", "سب"],              ["أذى", "سب"],        "أذى + سب → unchanged"],
];

let allPassed = true;
console.log("Concept filter — 3-row test\n" + "─".repeat(60));
for (const [input, expected, note] of tests) {
  const got = dropAthaIfWound(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} ${note}`);
  if (!ok) {
    console.log(`  input:    ${JSON.stringify(input)}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  got:      ${JSON.stringify(got)}`);
  }
}
console.log("─".repeat(60));
console.log(allPassed ? "ALL PASSED" : "FAILURES");
process.exit(allPassed ? 0 : 1);
