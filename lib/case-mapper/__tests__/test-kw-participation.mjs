// Addendum 2A — participation detector tests
// Node test: node lib/case-mapper/__tests__/test-kw-participation.mjs

import { factsMatchParticipation } from "../kw-matcher.mjs";

const CASES = [
  {
    id: "P-a",
    facts: "سلّم عثمان شيكاً موقعاً على بياض إلى شريكه لتسديد فاتورة، فملأه الشريك بمبلغ أكبر.",
    expected: false,
    note: "شريكه = business partner (space-separated, no واو prefix) + no crime-act verb → false.",
  },
  {
    id: "P-b",
    facts: "اتفق أحمد مع شريكه في المحل على تقسيم الأرباح مناصفة.",
    expected: false,
    note: "'اتفق مع' interrupted by 'أحمد' (non-contiguous) + no crime-act verb → false.",
  },
  {
    id: "P-c",
    facts: "تسلّم أخوان البضاعة من التاجر بصفتهما وكيلين، ثم سافر أحدهما ولم يتصرف فيها.",
    expected: false,
    note: "Two recipients but only one travelled; no second-actor pattern or crime-act → false.",
  },
  {
    id: "P-d",
    facts: "حرّض سامي صديقه على سرقة الدراجة، فسرقها الصديق بينما راقب سامي الطريق.",
    expected: true,
    note: "'حرّض' is unconditional single-kw trigger → true.",
  },
  {
    id: "P-e",
    facts: "سلّم التاجر البضاعة إلى شخص وشريكه، فباعاها واستوليا على ثمنها.",
    expected: true,
    note: "'وشريكه' (واو-prefixed, single token) + 'باع'/'استولى' crime-act verb → conjunction+crime gate → true.",
  },
  {
    id: "P-f",
    facts: "الشريك في الشركة رفع دعوى مدنية ضد شريكه لتصفية الحسابات.",
    expected: false,
    note: "'شريكه' is space-separated (no واو prefix); شريك removed from single-kw; no crime-act → false.",
  },
];

let passed = 0;
let failed = 0;

for (const c of CASES) {
  const got = factsMatchParticipation(c.facts);
  const ok = got === c.expected;
  if (ok) passed++; else failed++;
  const status = ok ? "✓ PASS" : "✗ FAIL";
  console.log(`${c.id}: ${status}  (expected=${c.expected}, got=${got})  — ${c.note}`);
}

console.log(`\nResult: ${passed}/${CASES.length} passed, ${failed} failed`);
if (failed === 0) console.log("ALL PASSED");
else { console.log("FAILURES — do not commit"); process.exit(1); }
