// Phase 6 check on an approved case (spec A3: a decisive gap stops drafting).
// Case: «استلم المتهم مبلغًا لشراء بضاعة ولم يسلّمها».
// Expected (approved by Safi):
//  - article 177 shown as a path to check, not as a finding;
//  - a decisive gap recorded: how the money was handed over, and whether there is any act of
//    disposal against the trust, or only a delay in performing;
//  - canDraft = false: drafting stops and the clarification questions are shown.
// The facts are not completed with assumptions.
// Run: node lib/legal-agent/__tests__/test-case-entrustment-stop.mjs
import assert from "node:assert/strict";
import { buildDocumentIndex } from "../intake.mjs";
import { buildIssueTable } from "../issues.mjs";
import { findGaps } from "../issues.mjs";
import { buildResearchList, RESEARCH_STATUS } from "../research.mjs";

const FACTS = "استلم المتهم مبلغًا لشراء بضاعة ولم يسلّمها.";

const index = buildDocumentIndex([
  { id: "complaint", name: "الوقائع كما وردت", kind: "text", text: FACTS },
]);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// Requirements that the facts do not yet establish.
const requirements = [
  { id: "delivery-terms", description: "كيف سُلّم المال: هل كان أمانة لغرض محدد (شراء بضاعة) أم قرضاً أو دفعة على الحساب؟", decisive: true, present: false, impact: 5 },
  { id: "disposal", description: "هل توجد وقائع تدل على التصرف في المال خلافاً للأمانة، أم مجرد تأخر في التنفيذ؟", decisive: true, present: false, impact: 5 },
  { id: "demand-and-refusal", description: "هل طُلب رد المال، وما الرد؟", decisive: false, present: false, impact: 3 },
];

const articleCandidate = {
  kind: "article",
  id: "criminal-law-1991-art-177",
  title: "القانون الجنائي لسنة 1991 — المادة 177 (خيانة الأمانة)",
  rawStatus: "in_force", // checked in the database 2026-11-09
  match: "semantic",
};

test("article 177 is listed as a usable source for checking (in force)", () => {
  const list = buildResearchList([articleCandidate]);
  assert.equal(list.usable.length, 1);
  assert.equal(list.usable[0].id, "criminal-law-1991-art-177");
  assert.equal(list.usable[0].label, "نافذ");
});

test("the issue states 177 as a question to check, not as a finding", () => {
  const [row] = buildIssueTable(
    [
      {
        id: "trust",
        question: "هل تتوافر أركان خيانة الأمانة (المادة 177) في هذه الوقائع، أم أنها نزاع تعاقدي أو تأخر في التنفيذ؟",
        supporting: [{ text: "استلم المتهم مبلغاً لشراء بضاعة", cite: { docId: "complaint", paragraph: 1 } }],
        opposing: [],
        actionNeeded: "استيضاح كيفية التسليم وأي تصرف في المال",
      },
    ],
    index
  );
  assert.match(row.question, /هل تتوافر/);
  assert.doesNotMatch(row.question, /ثبت|تحققت|أدان|مجرم/);
});

test("two decisive gaps are recorded, highest impact first", () => {
  const r = findGaps(requirements);
  assert.equal(r.blockingGaps.length, 2);
  assert.deepEqual(r.gaps.slice(0, 2).map((g) => g.id).sort(), ["delivery-terms", "disposal"]);
});

test("canDraft is false: drafting stops before the memo is written (A3)", () => {
  const r = findGaps(requirements);
  assert.equal(r.canDraft, false);
});

test("the stop holds even when the only decisive gap is the disposal question", () => {
  const r = findGaps([requirements[1]]);
  assert.equal(r.canDraft, false);
});

test("no fact is added to the case (no assumptions)", () => {
  assert.equal(index[0].text, FACTS);
  assert.equal(index[0].quotableVerbatim, true);
});

console.log(`\n${passed} tests passed`);
