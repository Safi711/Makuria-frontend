// Tests for the phase-8 preview on the synthetic matter.
// Run: node lib/legal-agent/__tests__/test-preview-case.mjs
import assert from "node:assert/strict";
import { SYNTHETIC_CASE, runPreviewCase } from "../preview-case.mjs";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const r = runPreviewCase();

test("both synthetic documents are readable and dated consistently", () => {
  assert.deepEqual(r.index.map((d) => d.status), ["readable", "readable"]);
  assert.equal(r.index[1].date, "2026-02-15");
});

test("timeline: 2 supported, 1 unsupported, 1 rejected, dated events in order", () => {
  const by = Object.fromEntries(r.timeline.map((e) => [e.id, e.status]));
  assert.equal(by.e1, "supported");
  assert.equal(by.e2, "supported");
  assert.equal(by.e3, "supported");
  assert.equal(by.e4, "unsupported");
  assert.equal(by.e5, "rejected");
  const dates = r.timeline.filter((e) => e.date).map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("issue table keeps supporting and opposing points without ranking", () => {
  const i2 = r.issueTable.find((i) => i.id === "i2");
  assert.equal(i2.supporting.length, 1);
  assert.equal(i2.opposing.length, 1);
  assert.equal(i2.opposing[0].status, "supported");
});

test("gaps: a non-decisive missing item does not stop drafting; the open point is listed", () => {
  assert.equal(r.gaps.canDraft, true);
  assert.deepEqual(r.gaps.gaps.map((g) => g.id), ["r3"]);
  assert.deepEqual(r.gaps.openPoints.map((g) => g.id), ["r4"]);
});

test("research: the case with its relevance and differences is usable; the lexical match is excluded", () => {
  assert.deepEqual(r.research.usable.map((x) => x.id), ["synthetic-article-delivery", "synthetic-case-delivery"]);
  assert.equal(r.research.excluded.some((x) => x.id === "synthetic-lexical-only"), true);
});

test("memo is built and passes its own self-review", () => {
  assert.equal(r.drafting, "ready");
  assert.equal(r.memo.ready, true);
  assert.equal(r.memo.selfReview.passed, true);
  assert.equal(r.memo.facts.length, 3, "only the three supported events become facts (A1)");
});

test("memo text carries no recommendation or outcome wording (A7)", () => {
  const forbidden = /أوصي|الأفضل|الأرجح|يُنصح|ننصح|سينجح|سيخسر|الحجة الراجحة|نسبة (?:النجاح|الفوز)|الحجة الأقوى|سيكسب/;
  assert.equal(forbidden.test(JSON.stringify(r.memo)), false);
});

test("a decisive missing item stops drafting (A3): no memo is produced", () => {
  const blocked = runPreviewCase({
    ...SYNTHETIC_CASE,
    requirements: SYNTHETIC_CASE.requirements.map((q) => (q.id === "r1" ? { ...q, present: false } : q)),
  });
  assert.equal(blocked.gaps.canDraft, false);
  assert.equal(blocked.memo, null);
  assert.equal(blocked.drafting, "stopped");
});

console.log(`\n${passed} tests passed`);
