// Phase 4 of the legal-agent (spec A4: every source opens; A5: every precedent explains
// why it applies and how it differs). Pure logic only. Candidates come in from the caller
// (the search itself is a separate step); this module classifies them.
//
// Status values come from the database (checked 2026-11-09):
//   articles.legal_status: in_force, repealed, disputed, unknown
//   cases.authority_status: good_law, limited, overruled, under_review, NULL
//
// Display status (spec: نافذ / غير محدد / تحت المراجعة / غير موثق):
//   in_force, good_law                  -> "نافذ"
//   unknown, NULL, limited              -> "غير محدد"   (limited: mapping still needs lawyer confirmation)
//   disputed, under_review              -> "تحت المراجعة"
//   repealed, overruled                 -> "ملغى"
// Only "نافذ" can be relied on as current law. Everything else is shown with its label.

export const SOURCE_KIND = Object.freeze({ ARTICLE: "article", CASE: "case" });
export const MATCH = Object.freeze({ SEMANTIC: "semantic", LEXICAL: "lexical" });
export const RESEARCH_STATUS = Object.freeze({
  USABLE: "usable",          // opens, applies, current
  SHOWN: "shown",            // opens and applies, but its status is not نافذ: shown with label
  LEXICAL_ONLY: "lexical_only", // matches the words only: not a source (spec: مطابقة لفظية)
  UNVERIFIED: "unverified",  // no openable identifier (spec: غير موثق)
  REJECTED: "rejected",      // precedent without relevance or differences (A5)
});

const STATUS_LABEL = Object.freeze({
  in_force: "نافذ",
  good_law: "نافذ",
  unknown: "غير محدد",
  limited: "غير محدد",
  disputed: "تحت المراجعة",
  under_review: "تحت المراجعة",
  repealed: "ملغى",
  overruled: "ملغى",
  null: "غير محدد",
});

export function statusLabel(raw) {
  const key = raw === null || raw === undefined ? "null" : String(raw);
  return STATUS_LABEL[key] ?? "غير محدد"; // an unrecognised value is never treated as نافذ
}

// candidate: {
//   kind: "article" | "case",
//   id: string,              // openable identifier (DB id or citation link)
//   title: string,
//   rawStatus: string|null,  // from the database
//   match: "semantic" | "lexical",
//   relevance?: string,      // why it applies (A5: required for a case)
//   differences?: string,    // how it differs from the matter (A5: required for a case)
// }
export function classifyCandidate(c) {
  if (!c || typeof c.id !== "string" || c.id.trim() === "") {
    return { title: c?.title ?? null, status: RESEARCH_STATUS.UNVERIFIED, label: "غير موثق", reason: "لا معرّف قابل للفتح" };
  }
  if (c.match === MATCH.LEXICAL) {
    return {
      id: c.id, title: c.title, status: RESEARCH_STATUS.LEXICAL_ONLY, label: "مطابقة لفظية",
      reason: "تطابق كلمات فقط، ولا يُعد سنداً",
    };
  }
  if (c.kind === SOURCE_KIND.CASE) {
    if (!c.relevance?.trim() || !c.differences?.trim()) {
      return {
        id: c.id, title: c.title, status: RESEARCH_STATUS.REJECTED, label: "مرفوض",
        reason: "السابقة بلا شرح للارتباط أو لأوجه الاختلاف (A5)",
      };
    }
  }
  const label = statusLabel(c.rawStatus);
  const current = label === "نافذ";
  return {
    id: c.id,
    title: c.title,
    kind: c.kind,
    status: current ? RESEARCH_STATUS.USABLE : RESEARCH_STATUS.SHOWN,
    label,
    relevance: c.relevance ?? null,
    differences: c.differences ?? null,
    reason: current ? null : `حالة السريان: ${label}؛ لا يُعامل كسارٍ`,
  };
}

// Returns the research list grouped by what can be relied on.
export function buildResearchList(candidates) {
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  const rows = candidates.map(classifyCandidate);
  return {
    usable: rows.filter((r) => r.status === RESEARCH_STATUS.USABLE),
    shown: rows.filter((r) => r.status === RESEARCH_STATUS.SHOWN),
    excluded: rows.filter((r) => r.status === RESEARCH_STATUS.LEXICAL_ONLY || r.status === RESEARCH_STATUS.UNVERIFIED || r.status === RESEARCH_STATUS.REJECTED),
  };
}
