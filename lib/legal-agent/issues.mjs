// Phase 3 of the legal-agent (spec A3: gaps stop drafting; A7: no professional decision).
// Pure logic only. Input comes from the caller; this module checks and arranges it.
//
//  - buildIssueTable: each issue lists supporting and opposing points. Every point is
//    checked against the document index (same rules as the timeline, A1). Nothing is
//    ranked, weighed or given a success figure (A7).
//  - findGaps: missing information, ordered by impact. A missing decisive item blocks
//    drafting (A3).

import { checkCitation } from "./timeline.mjs";

export const POINT_STATUS = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  REJECTED: "rejected",
});

// A7: the output must never say which argument wins or how likely a win is.
const FORBIDDEN_JUDGEMENT = /الحجة الراجحة|الحجة الأقوى|نسبة (?:النجاح|الفوز)|فرص (?:النجاح|الفوز)|سيكسب|سيخسر/;

function assertNoJudgement(value, where) {
  const walk = (v) => {
    if (typeof v === "string") {
      if (FORBIDDEN_JUDGEMENT.test(v)) {
        throw new Error(`A7: judgement wording not allowed in ${where}: "${v}"`);
      }
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
}

function checkPoint(point, index) {
  if (!point || typeof point.text !== "string") {
    throw new TypeError("point needs string text");
  }
  if (!point.cite) {
    return { text: point.text, cite: null, status: POINT_STATUS.UNSUPPORTED, reason: "غير مسندة" };
  }
  const check = checkCitation(point.cite, index);
  if (!check.ok) {
    return { text: point.text, cite: point.cite, status: POINT_STATUS.REJECTED, reason: check.reason };
  }
  return { text: point.text, cite: point.cite, status: POINT_STATUS.SUPPORTED, reason: null };
}

// issues: [{ id, question, supporting: [{text, cite?}], opposing: [{text, cite?}], actionNeeded }]
// Returns one row per issue. No ranking between supporting and opposing points.
export function buildIssueTable(issues, index) {
  if (!Array.isArray(issues)) throw new TypeError("issues must be an array");
  const seen = new Set();
  const rows = issues.map((issue) => {
    if (!issue || typeof issue.id !== "string" || typeof issue.question !== "string") {
      throw new TypeError("issue needs string id and question");
    }
    if (seen.has(issue.id)) throw new Error(`duplicate issue id: ${issue.id}`);
    seen.add(issue.id);
    const row = {
      id: issue.id,
      question: issue.question,
      supporting: (issue.supporting ?? []).map((p) => checkPoint(p, index)),
      opposing: (issue.opposing ?? []).map((p) => checkPoint(p, index)),
      actionNeeded: typeof issue.actionNeeded === "string" ? issue.actionNeeded : null,
    };
    assertNoJudgement(row, `issue ${issue.id}`);
    return row;
  });
  return rows;
}

// requirements: [{ id, description, decisive, present, note?, impact }]
//   present: true   -> stated in the source
//   present: false  -> missing (not stated and no indication of it)
//   present: "open" -> not decided: a point to assess, not a missing item (note says why)
// impact: 1 (low) to 5 (high), set by the caller.
// canDraft is false only when a decisive requirement is missing (present === false).
// Open points never block; they are listed for the lawyer.
export function findGaps(requirements) {
  if (!Array.isArray(requirements)) throw new TypeError("requirements must be an array");
  const byImpact = (a, b) => b.impact - a.impact || a.id.localeCompare(b.id);
  const toItem = (r) => {
    if (!r || typeof r.id !== "string" || typeof r.description !== "string") {
      throw new TypeError("requirement needs string id and description");
    }
    return { id: r.id, description: r.description, decisive: r.decisive === true, impact: Number(r.impact) || 1, note: r.note ?? null };
  };
  const missing = requirements.filter((r) => r.present === false).map(toItem).sort(byImpact);
  const openPoints = requirements.filter((r) => r.present === "open").map(toItem).sort(byImpact);
  const blockingGaps = missing.filter((g) => g.decisive);
  return {
    gaps: missing,
    openPoints,
    blockingGaps,
    canDraft: blockingGaps.length === 0, // A3: stop at drafting only while a decisive item is missing
  };
}
