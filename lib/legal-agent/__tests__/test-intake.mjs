// Tests for phase 1 intake (A1–A3). Run: node lib/legal-agent/__tests__/test-intake.mjs
import assert from "node:assert/strict";
import {
  STATUS,
  extractDate,
  assessDocument,
  buildDocumentIndex,
  blockingIssues,
} from "../intake.mjs";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const LONG =
  "بتاريخ 2026/03/15 أصدر المدير قراراً بتعيين ابن شقيقه في الوظيفة دون إعلان أو منافسة، وقد استوفى المؤهلات المطلوبة.";

test("extractDate returns single clear ISO date", () => {
  assert.equal(extractDate("بتاريخ 15/03/2026 وقع الإجراء"), "2026-03-15");
});

test("extractDate handles Arabic-Indic digits", () => {
  assert.equal(extractDate("بتاريخ ١٥/٠٣/٢٠٢٦"), "2026-03-15");
});

test("extractDate returns null when several different dates appear", () => {
  assert.equal(extractDate("2026-01-01 و 2026-02-02"), null);
});

test("extractDate ignores repeated identical dates", () => {
  assert.equal(extractDate("2026-01-01 ثم 2026-01-01"), "2026-01-01");
});

test("extractDate returns null for impossible dates", () => {
  assert.equal(extractDate("31/13/2026"), null);
});

test("text document with enough text is readable and dated", () => {
  const e = assessDocument({ id: "d1", name: "قرار", kind: "text", text: LONG });
  assert.equal(e.status, STATUS.READABLE);
  assert.equal(e.date, "2026-03-15");
  assert.deepEqual(e.parties, []);
});

test("readable document keeps normalized text for later phases", () => {
  const e = assessDocument({ id: "d3", name: "x", kind: "text", text: LONG + " ل ا تُعرض" });
  assert.match(e.text, /لا تُعرض$/);
  assert.equal(e.normalizationFixes, 1);
});

test("unreadable document does not keep text", () => {
  const e = assessDocument({ id: "p9", name: "s.pdf", kind: "pdf", text: "", pdfKind: "image" });
  assert.equal(e.text, null);
});

test("short text is incomplete, not guessed", () => {
  const e = assessDocument({ id: "d2", name: "ملاحظة", kind: "text", text: "قصير" });
  assert.equal(e.status, STATUS.INCOMPLETE);
  assert.equal(e.date, null);
});

test("PDF with no text layer is unreadable and blocks drafting", () => {
  const index = buildDocumentIndex([
    { id: "p1", name: "scan.pdf", kind: "pdf", text: "" },
    { id: "t1", name: "ok", kind: "text", text: LONG },
  ]);
  assert.equal(index[0].status, STATUS.UNREADABLE);
  assert.equal(index[1].status, STATUS.READABLE);
  const blocks = blockingIssues(index);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].id, "p1");
});

test("PDF with text layer is readable", () => {
  const e = assessDocument({ id: "p2", name: "x.pdf", kind: "pdf", text: LONG });
  assert.equal(e.status, STATUS.READABLE);
});

test("duplicate document ids are rejected", () => {
  assert.throws(
    () =>
      buildDocumentIndex([
        { id: "a", name: "1", kind: "text", text: LONG },
        { id: "a", name: "2", kind: "text", text: LONG },
      ]),
    /duplicate document id/
  );
});

test("unsupported kind is rejected", () => {
  assert.throws(() => assessDocument({ id: "x", name: "y", kind: "docx", text: LONG }), /unsupported kind/);
});

console.log(`\n${passed} tests passed`);
