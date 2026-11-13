// Phase 8 (preview): the limited agent on ONE synthetic matter.
// Every party, date, amount and clause below is invented for testing. No real client
// data is used here (phase-0 decision 3). Server-side only: this module runs on the
// server and nothing in it is sent to an external service.

import { buildDocumentIndex } from "./intake.mjs";
import { buildTimeline } from "./timeline.mjs";
import { buildIssueTable, findGaps } from "./issues.mjs";
import { buildResearchList } from "./research.mjs";
import { buildMemo } from "./draft.mjs";

export const SYNTHETIC_CASE = Object.freeze({
  title: "قضية اختبار اصطناعية: مطالبة بمبلغ وعقد غير مسلَّم",
  banner: "بيانات اصطناعية للاختبار فقط، وليست قضية حقيقية.",
  documents: [
    {
      id: "doc-a",
      name: "أقوال المدعي (اصطناعي)",
      kind: "text",
      text: [
        "مستند اصطناعي للاختبار فقط، وأطرافه وأرقامه من خيال.",
        "المدعي: سالم بشير الفاتح",
        "المدعى عليه: خالد عمر الزين",
        "بتاريخ 2026-03-10 تسلم المدعى عليه مبلغ خمسة آلاف جنيه بموجب إيصال رقم 14.",
        "لم يُسلَّم العقد الأصلي إلى المدعي حتى تاريخه.",
        "أرسل المدعي خطاباً للمدعى عليه بتاريخ 2026-04-02 يطالب فيه بالرد.",
      ].join("\n"),
    },
    {
      id: "doc-b",
      name: "عقد اصطناعي للاختبار (اصطناعي)",
      kind: "text",
      text: [
        "عقد اصطناعي للاختبار فقط.",
        "تاريخ توقيع العقد: 2026-02-15.",
        "البند الثالث: يلتزم المدعى عليه بتسليم النسخة الأصلية خلال ثلاثين يوماً من توقيع العقد.",
        "البند الخامس: يُحكم بالقانون السوداني ويختص القضاء السوداني بالنزاع.",
      ].join("\n"),
    },
  ],
  events: [
    { id: "e1", date: "2026-03-10", text: "تسلم المدعى عليه خمسة آلاف جنيه", cite: { docId: "doc-a", paragraph: 4 } },
    { id: "e2", date: "2026-02-15", text: "توقيع العقد", cite: { docId: "doc-b", paragraph: 2 } },
    { id: "e3", date: "2026-04-02", text: "مطالبة المدعي بالرد", cite: { docId: "doc-a", paragraph: 6 } },
    { id: "e4", date: null, text: "واقعة بلا إحالة (تُعرض ولا تدخل المذكرة)" },
    { id: "e5", date: null, text: "إحالة إلى فقرة غير موجودة (تُرفض)", cite: { docId: "doc-a", paragraph: 9 } },
  ],
  issues: [
    {
      id: "i1",
      question: "هل ثبت استلام المبلغ؟",
      supporting: [{ text: "الإيصال رقم 14 يذكر الاستلام", cite: { docId: "doc-a", paragraph: 4 }, quote: "تسلم المدعى عليه مبلغ خمسة آلاف جنيه" }],
      opposing: [{ text: "لم يرد توقيع المدعى عليه على الإيصال في النص المتاح" }],
      actionNeeded: "مراجعة صورة الإيصال الأصلية",
    },
    {
      id: "i2",
      question: "هل التزم المدعى عليه بتسليم النسخة الأصلية؟",
      supporting: [{ text: "البند الثالث يوجب التسليم خلال ثلاثين يوماً", cite: { docId: "doc-b", paragraph: 3 }, quote: "يلتزم المدعى عليه بتسليم النسخة الأصلية خلال ثلاثين يوماً" }],
      opposing: [{ text: "أفاد المدعي بأن العقد لم يُسلَّم حتى تاريخه", cite: { docId: "doc-a", paragraph: 5 }, quote: "لم يُسلَّم العقد الأصلي إلى المدعي" }],
      actionNeeded: "تحديد هل وقع تسليم لاحق بعد الخطاب",
    },
  ],
  requirements: [
    { id: "r1", description: "تاريخ توقيع العقد", decisive: true, present: true, impact: 5 },
    { id: "r2", description: "مدة التسليم المتفق عليها", decisive: true, present: true, impact: 4 },
    { id: "r3", description: "إيصال موقّع من المدعى عليه", decisive: false, present: false, impact: 3, note: "غير موجود في الملف" },
    { id: "r4", description: "هل سُدّد المبلغ جزئياً", decisive: false, present: "open", impact: 2, note: "لم يُحسم في المستندات؛ يقدّره المحامي" },
  ],
  candidates: [
    { kind: "article", id: "synthetic-article-delivery", title: "مادة اصطناعية: الالتزام بالتسليم في الموعد", rawStatus: "in_force", match: "semantic" },
    {
      kind: "case", id: "synthetic-case-delivery", title: "سابقة اصطناعية: التسليم بعد توقيع العقد", rawStatus: "good_law", match: "semantic",
      relevance: "تشابه في وجود التزام بالتسليم بعد التوقيع",
      differences: "تختلف في أن العقد هنا غير مكتوب في الملف",
    },
    { kind: "case", id: "synthetic-lexical-only", title: "تطابق كلمات فقط", rawStatus: "good_law", match: "lexical" },
  ],
  lawyerDecisions: [
    {
      question: "هل تُطالب الدعوى بالمبلغ الأصلي فقط أم معه تعويض عن التأخير؟",
      options: [
        { label: "المطالبة بالمبلغ الأصلي", effect: "يقتصر النزاع على المبلغ المستلم" },
        { label: "المطالبة مع تعويض عن التأخير", effect: "يحتاج بيان التعويض ومستنده" },
      ],
    },
  ],
});

/** Runs phases 1 to 5 on a matter. Returns every section, or stops at drafting when a decisive gap exists (A3). */
export function runPreviewCase(matter = SYNTHETIC_CASE) {
  const index = buildDocumentIndex(matter.documents);
  const timeline = buildTimeline(matter.events, index);
  const issueTable = buildIssueTable(matter.issues, index);
  const gaps = findGaps(matter.requirements);
  const research = buildResearchList(matter.candidates);

  if (!gaps.canDraft) {
    return { index, timeline, issueTable, gaps, research, memo: null, drafting: "stopped" };
  }

  // Only supported events become facts (A1). Points keep their own citation and quote.
  const facts = timeline.filter((e) => e.status === "supported").map((e) => ({ text: e.text, date: e.date, status: e.status, cite: e.cite }));
  const points = matter.issues.flatMap((i) => (i.supporting ?? []).filter((p) => p.cite).map((p) => ({ text: p.text, cite: p.cite, quote: p.quote })));
  const precedents = research.usable
    .filter((r) => r.kind === "case")
    .map((r) => ({ id: r.id, title: r.title, label: r.label, relevance: r.relevance, differences: r.differences }));

  const memo = buildMemo(
    {
      facts,
      issues: issueTable,
      points,
      precedents,
      gaps: gaps.gaps,
      lawyerDecisions: matter.lawyerDecisions,
    },
    index,
  );
  return { index, timeline, issueTable, gaps, research, memo, drafting: memo.ready ? "ready" : "not_ready" };
}
