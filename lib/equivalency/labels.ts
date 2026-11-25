// مرجع المعادلة القانونية — shared labels and types.
// Values mirror the CHECK constraints in
// docs/migrations/2026-11-23-equivalency-reference.sql; keep the two in step.

export const PAPER_STATUS = {
  draft: "مسودة",
  published: "منشورة",
  archived: "مؤرشفة",
} as const;
export type PaperStatus = keyof typeof PAPER_STATUS;

export const COMPLETENESS = {
  complete: "كاملة",
  incomplete: "ورقة ناقصة",
  doubtful: "مشكوك فيها",
  unknown: "لم تُراجع",
} as const;
export type Completeness = keyof typeof COMPLETENESS;

export const SESSION_MONTHS = ["فبراير", "مارس", "يوليو", "أغسطس", "ديسمبر", "أخرى"] as const;

export const QTYPE = {
  essay: "مقالي",
  practical: "مسألة عملية",
  mcq: "اختيار من متعدد",
  calculation: "حساب (مواريث)",
  terms: "ترجمة مصطلحات",
  errors: "استخراج الأخطاء",
  other: "أخرى",
} as const;
export type QType = keyof typeof QTYPE;

export const SOLUTION_KIND = {
  official: "حل رسمي",
  makuria: "حل استرشادي من مكوريا",
  external: "حل منشور من مصدر خارجي",
} as const;
export type SolutionKind = keyof typeof SOLUTION_KIND;

export const REVIEW_STATUS = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  published: "منشور",
} as const;
export type ReviewStatus = keyof typeof REVIEW_STATUS;

export const SOLUTION_PARTS = [
  { key: "issue_ar", label: "ماذا يطلب السؤال" },
  { key: "rules_ar", label: "القواعد" },
  { key: "application_ar", label: "التطبيق" },
  { key: "conclusion_ar", label: "النتيجة" },
] as const;

export function paperTitle(p: {
  title_ar?: string | null;
  session_month?: string | null;
  exam_year?: number | null;
}): string {
  if (p.title_ar) return p.title_ar;
  const when = [p.session_month ? `دورة ${p.session_month}` : null, p.exam_year ?? null]
    .filter(Boolean)
    .join(" ");
  return when || "ورقة بلا تاريخ";
}

export function isOneOf<T extends string>(v: unknown, keys: readonly T[]): v is T {
  return typeof v === "string" && (keys as readonly string[]).includes(v);
}
