// Tests for phase 2 (A1: citations). Run: node lib/legal-agent/__tests__/test-timeline.mjs
import assert from "node:assert/strict";
import { buildDocumentIndex } from "../intake.mjs";
import { buildTimeline, checkCitation, EVENT_STATUS } from "../timeline.mjs";

const P1 = "الفقرة الأولى تتحدث عن القرار الصادر بتاريخ 2026/03/15 بتعيين الموظف في الوظيفة المطلوبة للعمل.";
const P2 = "الفقرة الثانية تتحدث عن الإعلان الذي لم يُنشر للمنافسة على الوظيفة المذكورة في القرار السابق.";

const index = buildDocumentIndex([
  { id: "decision", name: "القرار", kind: "pdf", text: `${P1}\n${P2}`, pdfKind: "text", pageCount: 2 },
  { id: "letter", name: "الخطاب", kind: "text", text: `${P1}\n${P2}` },
  { id: "scan", name: "الممسوح", kind: "pdf", text: "", pdfKind: "image", pageCount: 3 },
]);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("a valid page citation is supported", () => {
  const r = checkCitation({ docId: "decision", page: 2 }, index);
  assert.equal(r.ok, true);
});

test("a valid paragraph citation on a text document is supported", () => {
  const r = checkCitation({ docId: "letter", paragraph: 2 }, index);
  assert.equal(r.ok, true);
});

test("a page beyond the document's page count is rejected", () => {
  const r = checkCitation({ docId: "decision", page: 5 }, index);
  assert.equal(r.ok, false);
  assert.match(r.reason, /غير موجودة/);
});

test("a paragraph beyond the paragraph count is rejected", () => {
  const r = checkCitation({ docId: "letter", paragraph: 9 }, index);
  assert.equal(r.ok, false);
});

test("an unknown document is rejected", () => {
  const r = checkCitation({ docId: "nope", page: 1 }, index);
  assert.equal(r.ok, false);
  assert.match(r.reason, /غير موجود في الفهرس/);
});

test("a citation to an unreadable document is rejected", () => {
  const r = checkCitation({ docId: "scan", page: 1 }, index);
  assert.equal(r.ok, false);
  assert.match(r.reason, /غير مقروء/);
});

test("a citation with both page and paragraph, or neither, is rejected", () => {
  assert.equal(checkCitation({ docId: "decision", page: 1, paragraph: 1 }, index).ok, false);
  assert.equal(checkCitation({ docId: "decision" }, index).ok, false);
});

test("a page citation to a text document without page count is rejected", () => {
  const r = checkCitation({ docId: "letter", page: 1 }, index);
  assert.equal(r.ok, false);
  assert.match(r.reason, /لا يحمل عدد صفحات/);
});

test("timeline: supported, unsupported and rejected events are all marked, none filled in", () => {
  const timeline = buildTimeline(
    [
      { id: "e1", date: "2026-03-15", text: "صدر القرار", cite: { docId: "decision", page: 1 } },
      { id: "e2", date: "2026-04-01", text: "نُشر الإعلان", cite: null },
      { id: "e3", date: "2026-02-01", text: "خطاب سابق", cite: { docId: "decision", page: 9 } },
    ],
    index
  );
  const byId = Object.fromEntries(timeline.map((e) => [e.id, e]));
  assert.equal(byId.e1.status, EVENT_STATUS.SUPPORTED);
  assert.equal(byId.e2.status, EVENT_STATUS.UNSUPPORTED);
  assert.equal(byId.e2.reason, "غير مسندة");
  assert.equal(byId.e3.status, EVENT_STATUS.REJECTED);
});

test("timeline is ordered by date; undated events come last in input order", () => {
  const timeline = buildTimeline(
    [
      { id: "late", date: "2026-04-01", text: "x", cite: null },
      { id: "undated1", text: "y", cite: null },
      { id: "early", date: "2026-01-01", text: "z", cite: null },
      { id: "undated2", text: "w", cite: null },
    ],
    index
  );
  assert.deepEqual(timeline.map((e) => e.id), ["early", "late", "undated1", "undated2"]);
});

test("duplicate event ids are rejected", () => {
  assert.throws(
    () => buildTimeline([{ id: "a", text: "x" }, { id: "a", text: "y" }], index),
    /duplicate event id/
  );
});

console.log(`\n${passed} tests passed`);
