// Test of the NEW modules (issues.mjs, research.mjs, intake.mjs) on one approved case.
//
// Case: scripts/abu-rannat-30.json, entry n=1. Approved facts (full text, Safi, 2026-11-09):
//   «استلم المتهم من الشاكي لشراء بضاعة ولم يسلّمها واحتفظ بالمال لنفسه».
// Approved expectation (Safi): the matched articles are 177 and 178, as the gold record
// shows. Showing both as candidates is NOT a finding that either crime is proven.
//
// What this test does NOT do:
//  - it does not run the live makuria.legal engine;
//  - it does not verify the site's behaviour;
//  - it does not pin canDraft = false automatically. canDraft comes from the requirement
//    table below, through findGaps. The table's "present" flags are my reading of the text and
//    need review by Safi / the lawyer.
//
// The short wording «استلم المتهم مبلغًا لشراء بضاعة ولم يسلّمها» is NOT the approved text.
// It is kept only as a derived case at the end, labelled as such.
//
// Run: node lib/legal-agent/__tests__/test-case-entrustment-gate.mjs
import assert from "node:assert/strict";
import { buildDocumentIndex } from "../intake.mjs";
import { buildIssueTable, findGaps, POINT_STATUS } from "../issues.mjs";
import { buildResearchList, RESEARCH_STATUS } from "../research.mjs";
import { checkCitation } from "../timeline.mjs";

const CASE_SOURCE = "scripts/abu-rannat-30.json#1";
const FULL_TEXT = "استلم المتهم من الشاكي لشراء بضاعة ولم يسلّمها واحتفظ بالمال لنفسه.";
const SHORT_TEXT = "استلم المتهم مبلغًا لشراء بضاعة ولم يسلّمها.";

// Requirement table: what each candidate article needs, and whether the approved text states it.
// Rule for drafting (fixed before the run): canDraft only when no decisive requirement is missing.
// A requirement is "present" only when the text states it. Nothing is inferred.
function requirementsFor(text) {
  const hasHandover = /لشراء بضاعة/.test(text);
  const hasDisposal = /احتفظ بالمال|تصرف|بدد|أنفق/.test(text);
  const hasIntent = /بسوء قصد|عمداً|عمدا/.test(text); // the text states no intent word
  const hasDeception = /خدع|وعد|ادعى كذباً|بيان كاذب|غش/.test(text); // none in the approved text
  return [
    { id: "177-entrusted", article: "177", description: "مال سُلّم على سبيل الأمانة لغرض محدد", decisive: true, present: hasHandover, impact: 5 },
    { id: "177-disposal", article: "177", description: "جحد المال أو تحويله إلى منفعته أو تبديده أو التصرف فيه", decisive: true, present: hasDisposal, impact: 5 },
    { id: "177-intent", article: "177", description: "سوء القصد (يلزم في المادة 177 ذاتها)", decisive: true, present: hasIntent, impact: 4 },
    { id: "178-deception", article: "178", description: "خداع شخص بأي وجه والتوصل بسوء قصد إلى كسب غير مشروع", decisive: true, present: hasDeception, impact: 4 },
    { id: "delivery-terms", article: "177", description: "شروط تسليم المال (مبلغ، تاريخ، شاهد أو وثيقة)", decisive: false, present: false, impact: 2 },
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

// ---- Approved text: full wording ----

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

test("the 177 point cites the retained-money paragraph and is supported", () => {
  const [row] = buildIssueTable(
    [{
      id: "177",
      question: "هل تتوافر أركان المادة 177 في الوقائع، أم أن الامتناع عن الرد وحده غير كافٍ؟",
      supporting: [{ text: "احتفظ المتهم بالمال لنفسه", cite: { docId: "complaint", paragraph: 1 } }],
      opposing: [],
      actionNeeded: "استيضاح القصد وكيفية التسليم",
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

test("gaps: the stated elements are present; the unstated ones are decisive gaps", () => {
  const r = findGaps(requirementsFor(FULL_TEXT));
  const missing = r.blockingGaps.map((g) => g.id).sort();
  assert.deepEqual(missing, ["177-intent", "178-deception"]);
});

test("canDraft is false here because two decisive elements are not stated (rule applied, not pinned)", () => {
  const r = findGaps(requirementsFor(FULL_TEXT));
  assert.equal(r.canDraft, false);
});

test("the drafting gate opens only when the missing decisive elements are supplied from a source", () => {
  const reqs = requirementsFor(FULL_TEXT).map((q) => ({ ...q, present: true }));
  const r = findGaps(reqs);
  assert.equal(r.canDraft, true);
});

test("no supplied fact: the full text is unchanged in the index", () => {
  assert.equal(index[0].text, FULL_TEXT);
});

// ---- Derived case: the short wording (not approved; kept only as a derived case) ----

test("DERIVED (not approved): the short wording has no retained-money element, so disposal is a decisive gap", () => {
  const derivedIndex = buildDocumentIndex([{ id: "c", name: "مشتقة", kind: "text", text: SHORT_TEXT }]);
  assert.equal(derivedIndex[0].status, "readable");
  const r = findGaps(requirementsFor(SHORT_TEXT));
  assert.ok(r.blockingGaps.some((g) => g.id === "177-disposal"));
  assert.equal(r.canDraft, false);
});

console.log(`\n${passed} tests passed (case: ${CASE_SOURCE})`);
