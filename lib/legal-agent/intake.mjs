// Phase 1 of the legal-agent (spec: claude/spec-legal-agent-file-intake-v1.md).
// Pure logic only: no network, no storage, no UI.
//
// A2: anything unreadable is flagged, never filled in.
// v1 supports text input and PDFs that already carry a text layer. Scanned
// PDFs (no text layer) are marked "unreadable", not OCR'd.

export const STATUS = Object.freeze({
  READABLE: "readable",
  INCOMPLETE: "incomplete",
  UNREADABLE: "unreadable",
});

import { detectVisualOrder, normalizeArabicText } from "./arabic-text.mjs";

const MIN_TEXT_CHARS = 40;

// Western or Arabic-Indic digits, separators / - .
const DATE_RE = /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})|(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/;

function toWesternDigits(s) {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
          .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

// Returns an ISO date string when a single clear date is present, else null.
// If several different dates appear, we do not guess which one matters.
export function extractDate(text) {
  if (!text) return null;
  const normalized = toWesternDigits(text);
  const found = new Set();
  const re = new RegExp(DATE_RE.source, "g");
  let m;
  while ((m = re.exec(normalized)) !== null) {
    let y, mo, d;
    if (m[1]) { y = m[1]; mo = m[2]; d = m[3]; }
    else { d = m[4]; mo = m[5]; y = m[6]; }
    const mm = mo.padStart(2, "0");
    const dd = d.padStart(2, "0");
    const month = Number(mm), day = Number(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    found.add(`${y}-${mm}-${dd}`);
  }
  return found.size === 1 ? [...found][0] : null;
}

// doc: {
//   id, name, kind: "text" | "pdf", text: string | null,
//   pdfKind?: "text" | "image" | "mixed"   (from extractPdfDocument, PDFs only)
// }
export function assessDocument(doc) {
  if (!doc || typeof doc.id !== "string" || typeof doc.name !== "string") {
    throw new TypeError("document needs string id and name");
  }
  if (doc.kind !== "text" && doc.kind !== "pdf") {
    throw new TypeError(`unsupported kind: ${doc.kind}`);
  }
  const raw = typeof doc.text === "string" ? doc.text.trim() : "";
  const order = detectVisualOrder(raw);
  const { text, fixes } = normalizeArabicText(raw);

  let status;
  let reason = null;
  if (doc.kind === "pdf" && (doc.pdfKind === "image" || text.length === 0)) {
    status = STATUS.UNREADABLE;
    reason = "لا نص مقروء في المستند (ممسوح ضوئياً أو بلا طبقة نص)";
  } else if (order.unreliable) {
    status = STATUS.UNREADABLE;
    reason = "ترتيب النص غير موثوق (حروف مخزنة بترتيب بصري)";
  } else if (doc.kind === "pdf" && doc.pdfKind === "mixed") {
    status = STATUS.INCOMPLETE;
    reason = "بعض الصفحات بلا طبقة نص؛ تحتاج صفحاتها مراجعة يدوية";
  } else if (text.length < MIN_TEXT_CHARS) {
    status = STATUS.INCOMPLETE;
    reason = "نص قصير جداً";
  } else {
    status = STATUS.READABLE;
  }

  return {
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    status,
    reason,
    date: status === STATUS.READABLE ? extractDate(text) : null,
    normalizationFixes: fixes,
    // Parties are not extracted in phase 1; left empty on purpose (A2).
    parties: [],
  };
}

// Builds the document index (deliverable 1). Order is kept as given.
export function buildDocumentIndex(docs) {
  if (!Array.isArray(docs)) throw new TypeError("docs must be an array");
  const seen = new Set();
  return docs.map((d) => {
    if (seen.has(d.id)) throw new Error(`duplicate document id: ${d.id}`);
    seen.add(d.id);
    return assessDocument(d);
  });
}

// Stop condition (spec): an unreadable document must be declared before drafting.
export function blockingIssues(index) {
  return index
    .filter((e) => e.status === STATUS.UNREADABLE)
    .map((e) => ({ id: e.id, reason: e.reason }));
}
