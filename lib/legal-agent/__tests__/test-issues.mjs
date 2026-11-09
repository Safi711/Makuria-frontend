// Tests for phase 3 (A3: gaps stop drafting; A7: no professional decision).
// Run: node lib/legal-agent/__tests__/test-issues.mjs
import assert from "node:assert/strict";
import { buildDocumentIndex } from "../intake.mjs";
import { buildIssueTable, findGaps, POINT_STATUS } from "../issues.mjs";

const P1 = "الفقرة الأولى تتحدث عن القرار الصادر بتاريخ 2026/03/15 بتعيين الموظف في الوظيفة المطلوبة للعمل.";
const P2 = "الفقرة الثانية تتحدث عن الإعلان الذي لم يُنشر للمنافسة على الوظيفة المذكورة في القرار السابق.";

const index = buildDocumentIndex([
  { id: "decision", name: "القرار", kind: "pdf", text: `${P1}\n${P2}`, pdfKind: "text", pageCount: 2 },
]);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// ---- A3: gaps ----

test("a missing decisive item blocks drafting", () => {
  const r = findGaps([
    { id: "date-of-decision", description: "تاريخ القرار الإداري", decisive: true, present: false, impact: 5 },
    { id: "copy-of-ad", description: "نسخة من الإعلان", decisive: false, present: true, impact: 2 },
  ]);
  assert.equal(r.canDraft, false);
  assert.deepEqual(r.blockingGaps.map((g) => g.id), ["date-of-decision"]);
});

test("a complete file (no missing items) allows drafting", () => {
  const r = findGaps([
    { id: "date-of-decision", description: "تاريخ القرار", decisive: true, present: true, impact: 5 },
  ]);
  assert.equal(r.canDraft, true);
  assert.deepEqual(r.gaps, []);
});

test("a missing non-decisive item is listed but does not block drafting", () => {
  const r = findGaps([
    { id: "minor", description: "تاريخ استلام الخطاب", decisive: false, present: false, impact: 1 },
  ]);
  assert.equal(r.canDraft, true);
  assert.equal(r.gaps.length, 1);
});

test("gaps are ordered by impact, highest first", () => {
  const r = findGaps([
    { id: "low", description: "أ", decisive: false, present: false, impact: 1 },
    { id: "high", description: "ب", decisive: false, present: false, impact: 5 },
    { id: "mid", description: "ج", decisive: false, present: false, impact: 3 },
  ]);
  assert.deepEqual(r.gaps.map((g) => g.id), ["high", "mid", "low"]);
});

// ---- A1 and A7: issue table ----

test("issue table keeps supporting and opposing points in their own lists, with citation status", () => {
  const [row] = buildIssueTable(
    [
      {
        id: "i1",
        question: "هل صدر القرار قبل الإعلان؟",
        supporting: [{ text: "القرار بتاريخ 15 مارس", cite: { docId: "decision", paragraph: 1 } }],
        opposing: [
          { text: "الإعلان لم يُنشر", cite: { docId: "decision", paragraph: 2 } },
          { text: "رأي الطرف الآخر بلا سند" },
          { text: "إحالة مكسورة", cite: { docId: "decision", paragraph: 9 } },
        ],
        actionNeeded: "طلب نسخة الإعلان من الجهة",
      },
    ],
    index
  );
  assert.equal(row.supporting[0].status, POINT_STATUS.SUPPORTED);
  assert.equal(row.opposing[0].status, POINT_STATUS.SUPPORTED);
  assert.equal(row.opposing[1].status, POINT_STATUS.UNSUPPORTED);
  assert.equal(row.opposing[1].reason, "غير مسندة");
  assert.equal(row.opposing[2].status, POINT_STATUS.REJECTED);
  assert.equal(row.actionNeeded, "طلب نسخة الإعلان من الجهة");
});

test("issue table has no ranking or success figure field (A7)", () => {
  const [row] = buildIssueTable(
    [{ id: "i1", question: "س", supporting: [], opposing: [] }],
    index
  );
  for (const key of Object.keys(row)) {
    assert.ok(!/rank|score|winner|probability|percent/i.test(key), `unexpected field ${key}`);
  }
});

test("judgement wording such as 'the stronger argument' is refused (A7)", () => {
  assert.throws(
    () =>
      buildIssueTable(
        [{ id: "i1", question: "س", supporting: [{ text: "الحجة الراجحة هنا" }], opposing: [] }],
        index
      ),
    /A7/
  );
});

test("duplicate issue ids are rejected", () => {
  assert.throws(
    () =>
      buildIssueTable(
        [
          { id: "a", question: "س", supporting: [], opposing: [] },
          { id: "a", question: "ص", supporting: [], opposing: [] },
        ],
        index
      ),
    /duplicate issue id/
  );
});

test("an open requirement is listed as an open point and never blocks drafting", () => {
  const r = findGaps([
    { id: "intent", description: "سوء القصد", decisive: true, present: "open", note: "قرينة تحتاج تقييمًا", impact: 4 },
  ]);
  assert.equal(r.canDraft, true);
  assert.equal(r.gaps.length, 0);
  assert.deepEqual(r.openPoints.map((g) => g.id), ["intent"]);
});

console.log(`\n${passed} tests passed`);
