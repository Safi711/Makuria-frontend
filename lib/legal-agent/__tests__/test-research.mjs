// Tests for phase 4 (A4: sources open; A5: precedents explain relevance and differences).
// Run: node lib/legal-agent/__tests__/test-research.mjs
import assert from "node:assert/strict";
import { buildResearchList, classifyCandidate, RESEARCH_STATUS, statusLabel } from "../research.mjs";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("status mapping: database values map to the spec's labels", () => {
  assert.equal(statusLabel("in_force"), "نافذ");
  assert.equal(statusLabel("good_law"), "نافذ");
  assert.equal(statusLabel("unknown"), "غير محدد");
  assert.equal(statusLabel(null), "غير محدد");
  assert.equal(statusLabel("disputed"), "تحت المراجعة");
  assert.equal(statusLabel("under_review"), "تحت المراجعة");
  assert.equal(statusLabel("repealed"), "ملغى");
  assert.equal(statusLabel("overruled"), "ملغى");
});

test("an unrecognised status is never treated as نافذ", () => {
  assert.equal(statusLabel("something_new"), "غير محدد");
});

test("a semantic article match with an id and in_force status is usable (A4)", () => {
  const r = classifyCandidate({ kind: "article", id: "art-139", title: "المادة 139", rawStatus: "in_force", match: "semantic" });
  assert.equal(r.status, RESEARCH_STATUS.USABLE);
  assert.equal(r.label, "نافذ");
});

test("a source with status 'unknown' is shown with its label, not treated as current", () => {
  const r = classifyCandidate({ kind: "article", id: "art-x", title: "مادة", rawStatus: "unknown", match: "semantic" });
  assert.equal(r.status, RESEARCH_STATUS.SHOWN);
  assert.equal(r.label, "غير محدد");
  assert.match(r.reason, /لا يُعامل كسارٍ/);
});

test("a disputed article is shown as under review, not as in force", () => {
  const r = classifyCandidate({ kind: "article", id: "art-d", title: "مادة", rawStatus: "disputed", match: "semantic" });
  assert.equal(r.status, RESEARCH_STATUS.SHOWN);
  assert.equal(r.label, "تحت المراجعة");
});

test("a repealed source is shown as repealed and is not usable", () => {
  const r = classifyCandidate({ kind: "article", id: "art-r", title: "مادة", rawStatus: "repealed", match: "semantic" });
  assert.notEqual(r.status, RESEARCH_STATUS.USABLE);
  assert.equal(r.label, "ملغى");
});

test("no openable identifier means unverified (A4: غير موثق)", () => {
  const r = classifyCandidate({ kind: "case", id: "  ", title: "حكم", rawStatus: "good_law", match: "semantic", relevance: "x", differences: "y" });
  assert.equal(r.status, RESEARCH_STATUS.UNVERIFIED);
  assert.equal(r.label, "غير موثق");
});

test("a lexical-only match (word 'تعيين' against a bank circular) is not a source", () => {
  const r = classifyCandidate({ kind: "article", id: "bank-15", title: "منشور بنك السودان 15", rawStatus: "in_force", match: "lexical" });
  assert.equal(r.status, RESEARCH_STATUS.LEXICAL_ONLY);
  assert.equal(r.label, "مطابقة لفظية");
});

test("a precedent without relevance or differences is rejected (A5)", () => {
  const r = classifyCandidate({ kind: "case", id: "case-1", title: "حكم", rawStatus: "good_law", match: "semantic" });
  assert.equal(r.status, RESEARCH_STATUS.REJECTED);
  assert.match(r.reason, /A5/);
});

test("a precedent with relevance and differences is usable when good law", () => {
  const r = classifyCandidate({
    kind: "case", id: "case-2", title: "حكم", rawStatus: "good_law", match: "semantic",
    relevance: "الواقعة نفسها: تعيين دون إعلان", differences: "هنا الإعلان لم يُنشر أصلاً",
  });
  assert.equal(r.status, RESEARCH_STATUS.USABLE);
  assert.equal(r.relevance, "الواقعة نفسها: تعيين دون إعلان");
});

test("buildResearchList separates usable, shown and excluded items", () => {
  const list = buildResearchList([
    { kind: "article", id: "a1", title: "١", rawStatus: "in_force", match: "semantic" },
    { kind: "article", id: "a2", title: "٢", rawStatus: "unknown", match: "semantic" },
    { kind: "article", id: "a3", title: "٣", rawStatus: "in_force", match: "lexical" },
    { kind: "article", id: "", title: "٤", rawStatus: "in_force", match: "semantic" },
  ]);
  assert.deepEqual(list.usable.map((r) => r.id), ["a1"]);
  assert.deepEqual(list.shown.map((r) => r.id), ["a2"]);
  assert.equal(list.excluded.length, 2);
});

console.log(`\n${passed} tests passed`);
