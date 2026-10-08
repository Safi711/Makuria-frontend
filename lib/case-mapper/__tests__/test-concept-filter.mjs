// Commit 8 — dropAthaIfWound: when جرح عمد is present, drop أذى.
// Commit 9 — dropBareJurhIfWound: when جرح عمد is present, drop bare جرح.
// Commit 10 — dropAthaIfBareWound: when جرح is present, drop أذى.
// Run with: node lib/case-mapper/__tests__/test-concept-filter.mjs
import { dropAthaIfWound, dropBareJurhIfWound, dropAthaIfBareWound } from "../kw-matcher.mjs";

const tests = [
  // dropAthaIfWound (Commit 8)
  { fn: dropAthaIfWound, input: ["جرح عمد", "أذى", "جرح"], expected: ["جرح عمد", "جرح"], note: "dropAthaIfWound: جرح عمد present → أذى dropped" },
  { fn: dropAthaIfWound, input: ["أذى"],                    expected: ["أذى"],            note: "dropAthaIfWound: أذى alone → unchanged" },
  { fn: dropAthaIfWound, input: ["أذى", "سب"],              expected: ["أذى", "سب"],      note: "dropAthaIfWound: أذى + سب, no جرح عمد → unchanged" },
  // dropBareJurhIfWound (Commit 9)
  { fn: dropBareJurhIfWound, input: ["جرح عمد", "جرح"],     expected: ["جرح عمد"],        note: "dropBareJurhIfWound: جرح عمد present → جرح dropped" },
  { fn: dropBareJurhIfWound, input: ["جرح"],                 expected: ["جرح"],            note: "dropBareJurhIfWound: جرح alone → unchanged" },
  { fn: dropBareJurhIfWound, input: ["جرح", "أذى"],          expected: ["جرح", "أذى"],    note: "dropBareJurhIfWound: جرح + أذى, no جرح عمد → unchanged" },
  // dropAthaIfBareWound (Commit 10)
  { fn: dropAthaIfBareWound, input: ["جرح", "أذى"],          expected: ["جرح"],            note: "dropAthaIfBareWound: جرح present → أذى dropped" },
  { fn: dropAthaIfBareWound, input: ["أذى"],                 expected: ["أذى"],            note: "dropAthaIfBareWound: أذى alone, no جرح → unchanged" },
  { fn: dropAthaIfBareWound, input: ["جرح", "سب"],           expected: ["جرح", "سب"],      note: "dropAthaIfBareWound: جرح + سب (no أذى) → unchanged" },
];

let allPassed = true;
console.log("Concept filter — 9-row test\n" + "─".repeat(60));
for (const { fn, input, expected, note } of tests) {
  const got = fn(input);
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
