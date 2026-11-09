// Tests for phase 5 (A7: no professional decision; A8: self-review before delivery).
// Run: node lib/legal-agent/__tests__/test-draft.mjs
import assert from "node:assert/strict";
import { buildDocumentIndex } from "../intake.mjs";
import { buildMemo, FINAL_NOTE, selfReview } from "../draft.mjs";

const P1 = "الفقرة الأولى تتحدث عن القرار الصادر بتاريخ 2026/03/15 بتعيين الموظف في الوظيفة المطلوبة للعمل.";
const P2 = "الفقرة الثانية تتحدث عن الإعلان الذي لم يُنشر للمنافسة على الوظيفة المذكورة في القرار السابق.";

const index = buildDocumentIndex([
  { id: "decision", name: "القرار", kind: "pdf", text: `${P1}\n${P2}`, pdfKind: "text", pageCount: 2 },
  { id: "letter", name: "الخطاب", kind: "text", text: `${P1}\n${P2}` },
]);

// Arabic text taken from a PDF: quotes must be checked against the source first.
const pdfIndex = buildDocumentIndex([
  { id: "pdf-ar", name: "قرار", kind: "pdf", text: `${P1}\n${P2}`, pdfKind: "text", pageCount: 2 },
]);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const goodInput = () => ({
  facts: [
    { text: "صدر القرار بالتعيين", date: "2026-03-15", status: "supported", cite: { docId: "decision", paragraph: 1 } },
    { text: "نُشر الإعلان", date: null, status: "unsupported", cite: null, reason: "غير مسندة" },
  ],
  issues: [{ id: "i1", question: "هل سبق الإعلان التعيين؟" }],
  points: [
    { text: "القرار متقدم على الإعلان", cite: { docId: "letter", paragraph: 1 }, quote: "بتعيين الموظف" },
  ],
  precedents: [{ id: "case-2", title: "حكم", label: "نافذ" }],
  gaps: [{ id: "g1", description: "نسخة الإعلان", decisive: false, impact: 2 }],
  lawyerDecisions: [
    {
      question: "هل يُبدأ بالتحكيم أو بإنذار أخير؟",
      options: [
        { label: "التحكيم", effect: "يفتح مساراً أطول ويحتاج شرط تحكيم في العقد" },
        { label: "إنذار أخير", effect: "أسرع ويترك أثره على المهلة" },
      ],
    },
  ],
});

test("a clean memo is ready, carries the final note, and has all seven parts", () => {
  const memo = buildMemo(goodInput(), index);
  assert.equal(memo.ready, true);
  assert.equal(memo.finalNote, FINAL_NOTE);
  for (const key of ["facts", "issues", "points", "precedents", "gaps", "lawyerDecisions"]) {
    assert.ok(key in memo.sections, `missing section ${key}`);
  }
  assert.equal(memo.selfReview.passed, true);
});

test("unsupported facts stay marked unsupported in the memo; they do not fail the review", () => {
  const memo = buildMemo(goodInput(), index);
  assert.equal(memo.sections.facts[1].status, "unsupported");
  assert.equal(memo.sections.facts[1].reason, "غير مسندة");
});

test("a deliberately broken citation is caught and the memo is not ready (A8)", () => {
  const input = goodInput();
  input.points[0].cite = { docId: "decision", page: 9 };
  const memo = buildMemo(input, index);
  assert.equal(memo.ready, false);
  assert.ok(memo.selfReview.findings.some((f) => f.where === "الأدلة 1" && /غير موجودة/.test(f.problem)));
});

test("a quote that does not match the source is flagged", () => {
  const input = goodInput();
  input.points[0].quote = "بتعيين المدير العام";
  const review = selfReview({ facts: [], points: input.points }, index);
  assert.equal(review.passed, false);
  assert.match(review.findings[0].problem, /لا يطابق/);
});

test("a quote from an Arabic PDF is flagged for source check, not passed", () => {
  const review = selfReview(
    { facts: [], points: [{ text: "x", cite: { docId: "pdf-ar", paragraph: 1 }, quote: "بتعيين الموظف" }] },
    pdfIndex
  );
  assert.equal(review.passed, false);
  assert.match(review.findings[0].problem, /مطابقة بالمصدر/);
});

test("a lawyer decision worded as a recommendation is refused (A7)", () => {
  const input = goodInput();
  input.lawyerDecisions[0].options[0].effect = "أوصي بالتحكيم لأنه الأفضل";
  assert.throws(() => buildMemo(input, index), /A7/);
});

test("a neutral decision with options and effects is accepted", () => {
  const memo = buildMemo(goodInput(), index);
  assert.equal(memo.sections.lawyerDecisions[0].options.length, 2);
});

test("a precedent-free memo with no points still reviews cleanly", () => {
  const memo = buildMemo({ facts: [], points: [], precedents: [], gaps: [], lawyerDecisions: [] }, index);
  assert.equal(memo.ready, true);
});

console.log(`\n${passed} tests passed`);
