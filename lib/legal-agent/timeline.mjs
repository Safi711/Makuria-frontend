// Phase 2 of the legal-agent (spec A1: every event is cited to a document and a place in it).
// Pure logic only. Events come in from the caller; this module checks the citations.
//
// Outcomes per event:
//  - "supported":   the citation points to a readable document and an existing place.
//  - "unsupported": no citation given. Marked, never filled in (A1).
//  - "rejected":    a citation was given but does not resolve (unknown document,
//                   unreadable document, or a page/paragraph that does not exist).

export const EVENT_STATUS = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  REJECTED: "rejected",
});

// cite: { docId, page?, paragraph? }. Exactly one of page or paragraph is expected.
export function checkCitation(cite, index) {
  if (!cite) return { ok: false, reason: "لا توجد إحالة" };
  if (typeof cite.docId !== "string") return { ok: false, reason: "الإحالة بلا معرّف مستند" };

  const doc = index.find((d) => d.id === cite.docId);
  if (!doc) return { ok: false, reason: `المستند غير موجود في الفهرس: ${cite.docId}` };
  if (doc.status !== "readable") {
    return { ok: false, reason: "المستند غير مقروء؛ لا يمكن الإحالة إليه" };
  }

  const hasPage = cite.page !== undefined;
  const hasPara = cite.paragraph !== undefined;
  if (hasPage === hasPara) {
    return { ok: false, reason: "يجب تحديد صفحة أو فقرة واحدة" };
  }

  if (hasPage) {
    if (!Number.isInteger(cite.page) || cite.page < 1) {
      return { ok: false, reason: "رقم الصفحة غير صالح" };
    }
    if (doc.pageCount == null) {
      return { ok: false, reason: "المستند لا يحمل عدد صفحات، فلا تُقبل إحالة صفحية" };
    }
    if (cite.page > doc.pageCount) {
      return { ok: false, reason: `الصفحة ${cite.page} غير موجودة؛ عدد الصفحات ${doc.pageCount}` };
    }
  } else {
    if (!Number.isInteger(cite.paragraph) || cite.paragraph < 1) {
      return { ok: false, reason: "رقم الفقرة غير صالح" };
    }
    if (cite.paragraph > doc.paragraphCount) {
      return { ok: false, reason: `الفقرة ${cite.paragraph} غير موجودة؛ عدد الفقرات ${doc.paragraphCount}` };
    }
  }
  return { ok: true };
}

// events: [{ id, date?, text, cite? }]
export function buildTimeline(events, index) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  const seen = new Set();
  const out = events.map((e) => {
    if (!e || typeof e.id !== "string" || typeof e.text !== "string") {
      throw new TypeError("event needs string id and text");
    }
    if (seen.has(e.id)) throw new Error(`duplicate event id: ${e.id}`);
    seen.add(e.id);

    if (!e.cite) {
      return { id: e.id, date: e.date ?? null, text: e.text, status: EVENT_STATUS.UNSUPPORTED, cite: null, reason: "غير مسندة" };
    }
    const check = checkCitation(e.cite, index);
    if (!check.ok) {
      return { id: e.id, date: e.date ?? null, text: e.text, status: EVENT_STATUS.REJECTED, cite: e.cite, reason: check.reason };
    }
    return { id: e.id, date: e.date ?? null, text: e.text, status: EVENT_STATUS.SUPPORTED, cite: e.cite, reason: null };
  });

  // Dated events in date order; undated events keep their input order at the end.
  const dated = out.filter((e) => e.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const undated = out.filter((e) => !e.date);
  return [...dated, ...undated];
}
