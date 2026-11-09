// Test of the NEW modules (intake, issues, research) on one approved case.
//
// Case: scripts/abu-rannat-30.json, entry n=1 (gold: 177 and 178).
// Approved full text (Safi):
//   «استلم المتهم من الشاكي لشراء بضاعة ولم يسلّمها واحتفظ بالمال لنفسه».
// Expected: 177 and 178 shown as candidates. Showing them is not a finding that either
// crime is proven.
//
// Element status (fixed before the run):
//   true     stated in the source. "احتفظ بالمال لنفسه" is a stated fact that points to
//            disposal for his own benefit. It is not independent proof of disposal.
//   "open"   not decided. Absence of an explicit statement does not mean absence, and the
//            facts may still allow an inference. Open points never block drafting.
//   false    missing: not stated and nothing in the facts indicates it. A decisive missing
//            element blocks drafting.
//
// The gate (canDraft) comes from findGaps. It is not pinned here by hand.
//
// NOT tested: the live makuria.legal engine, and the site's behaviour.
//
// Run: node lib/legal-agent/__tests__/test-case-entrustment-gate.mjs
import assert from "node:assert/strict";
import { buildDocumentIndex } from "../intake.mjs";
import { buildIssueTable, findGaps, POINT_STATUS } from "../issues.mjs";
import { buildResearchList } from "../research.mjs";
import { checkCitation } from "../timeline.mjs";

const CASE_SOURCE = "scripts/abu-rannat-30.json#1";
const FULL_TEXT = "استلم المتهم من الشاكي لشراء بضاعة ولم يسلّمها واحتفظ بالمال لنفسه.";
const SHORT_TEXT = "استلم المتهم مبلغًا لشراء بضاعة ولم يسلّمها.";

// Requirement table for the case, from the text itself.
function requirementsFor(text) {
  const hasHandover = /لشراء بضاعة/.test(text);
  const hasRetention = /احتفظ بالمال|تصرف|بدد|أنفق/.test(text);
  const hasDeception = /خدع|وعد|ادعى كذباً|بيان كاذب|غش/.test(text);
  return [
    { id: "177-entrusted", article: "177", description: "مال سُلّم على سبيل الأمانة لغرض محدد", decisive: true,
      present: hasHandover ? true : false, impact: 5 },
    { id: "177-disposal", article: "177", description: "جحد المال أو تحويله إلى منفعته أو تبديده أو التصرف فيه", decisive: true,
      present: hasRetention ? true : false, note: "واقعة مذكورة تشير إلى التصرف، وليست دليلاً مستقلاً يثبته", impact: 5 },
    { id: "177-intent", article: "177", description: "سوء القصد", decisive: true,
      present: "open", note: "غير مصرح به؛ توجد قرينة تحتاج تقييمًا. عدم ذكره صراحةً لا يعني انتفاءه", impact: 4 },
    { id: "178-deception", article: "178", description: "خداع شخص بأي وجه والتوصل بسوء قصد إلى كسب غير مشروع", decisive: true,
      present: hasDeception ? true : false, note: "لا يذكر النص خداعاً ولا قرينة عليه؛ لا يُفترض", impact: 4 },
    { id: "delivery-terms", article: "177", description: "شروط تسليم المال (مبلغ، تاريخ، شاهد أو وثيقة)", decisive: false,
      present: false, impact: 2 },
  ];
}

const index = buildDocumentIndex([
  { id: "complaint", name: "الوقائع كما وردت", kind: "text", text: FULL_TEXT },
]);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("approved text is readable and its paragraph citation resolves", () => {
  assert.equal(index[0].status, "readable");
  assert.equal(checkCitation({ docId: "complaint", paragraph: 1 }, index).ok, true);
});

test("article 177 is a usable candidate (in force in the database, checked 2026-11-09)", () => {
  const list = buildResearchList([
    { kind: "article", id: "criminal-law-1991-art-177", title: "القانون الجنائي 1991 — م.177", rawStatus: "in_force", match: "semantic" },
  ]);
  assert.equal(list.usable[0].id, "criminal-law-1991-art-177");
});

test("article 178 is a usable candidate (in force in the database, checked 2026-11-09)", () => {
  const list = buildResearchList([
    { kind: "article", id: "criminal-law-1991-art-178", title: "القانون الجنائي 1991 — م.178", rawStatus: "in_force", match: "semantic" },
  ]);
  assert.equal(list.usable[0].id, "criminal-law-1991-art-178");
});

test("the 177 retention point is supported by its paragraph citation", () => {
  const [row] = buildIssueTable(
    [{
      id: "177",
      question: "هل تتوافر أركان المادة 177 في الوقائع، أم أن الامتناع عن الرد وحده غير كافٍ؟",
      supporting: [{ text: "احتفظ المتهم بالمال لنفسه", cite: { docId: "complaint", paragraph: 1 } }],
      opposing: [],
      actionNeeded: "تقييم القرينة على القصد، واستيضاح كيفية التسليم",
    }],
    index
  );
  assert.equal(row.supporting[0].status, POINT_STATUS.SUPPORTED);
});

test("the 178 issue has no supporting point: no deception is invented from the text", () => {
  const [row] = buildIssueTable(
    [{
      id: "178",
      question: "هل وقع خداع يستوجبه المادة 178؟ النص لا يذكر وسيلة خداع، ولم يُفترض شيء.",
      supporting: [],
      opposing: [],
      actionNeeded: "استيضاح وسيلة الاستلام: هل كان بوعد أو بيان غير صحيح؟",
    }],
    index
  );
  assert.equal(row.supporting.length, 0);
});

test("intent is an open point, not a missing item", () => {
  const r = findGaps(requirementsFor(FULL_TEXT));
  assert.deepEqual(r.openPoints.map((g) => g.id), ["177-intent"]);
  assert.ok(!r.gaps.some((g) => g.id === "177-intent"));
  assert.match(r.openPoints[0].note, /قرينة تحتاج تقييمًا/);
});

test("the stated elements are not listed as gaps", () => {
  const r = findGaps(requirementsFor(FULL_TEXT));
  assert.ok(!r.gaps.some((g) => g.id === "177-entrusted" || g.id === "177-disposal"));
});

test("the only blocking gap is the deception element of 178 (decisive, not stated)", () => {
  const r = findGaps(requirementsFor(FULL_TEXT));
  assert.deepEqual(r.blockingGaps.map((g) => g.id), ["178-deception"]);
});

test("canDraft is false because of that decisive gap; intent does not block", () => {
  const r = findGaps(requirementsFor(FULL_TEXT));
  assert.equal(r.canDraft, false);
});

test("the gate opens when the decisive deception element is supplied from a source; intent stays open and does not block", () => {
  const reqs = requirementsFor(FULL_TEXT).map((q) => (q.id === "178-deception" ? { ...q, present: true } : q));
  const r = findGaps(reqs);
  assert.equal(r.canDraft, true);
  assert.deepEqual(r.openPoints.map((g) => g.id), ["177-intent"]);
});

test("the full text is unchanged in the index: no supplied facts", () => {
  assert.equal(index[0].text, FULL_TEXT);
});

// ---- Derived case: short wording. NOT approved; kept only as a derived case. ----

test("DERIVED (not approved): without the retention clause, disposal is a missing decisive element", () => {
  const derivedIndex = buildDocumentIndex([{ id: "c", name: "مشتقة", kind: "text", text: SHORT_TEXT }]);
  assert.equal(derivedIndex[0].status, "readable");
  const r = findGaps(requirementsFor(SHORT_TEXT));
  assert.ok(r.blockingGaps.some((g) => g.id === "177-disposal"));
  assert.equal(r.canDraft, false);
});

console.log(`\n${passed} tests passed (case: ${CASE_SOURCE})`);
