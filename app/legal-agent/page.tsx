// Phase 8 preview page for the legal agent. Server-rendered only: the matter is
// processed on the server and no client script runs. Synthetic data only.
// Not linked from the live site; robots are told not to index it.
import type { Metadata } from "next";
import { SYNTHETIC_CASE, runPreviewCase } from "../../lib/legal-agent/preview-case.mjs";

export const metadata: Metadata = {
  title: "وكيل تجهيز الملف (معاينة)",
  robots: { index: false, follow: false },
};

type Cite = { docId: string; page?: number; paragraph?: number } | null | undefined;
type Point = { text: string; cite: Cite; status: string; quote?: string };
type Row = { id?: string; title: string; label: string; reason?: string | null };
type Gap = { id: string; description: string; decisive: boolean; note: string | null };
type PreviewResult = {
  index: { id: string; name: string; status: string; date: string | null }[];
  timeline: { id: string; date: string | null; text: string; status: string; cite: Cite; reason: string | null }[];
  issueTable: { id: string; question: string; supporting: Point[]; opposing: Point[]; actionNeeded: string | null }[];
  gaps: { gaps: Gap[]; openPoints: Gap[]; canDraft: boolean };
  research: { usable: Row[]; shown: Row[]; excluded: Row[] };
  memo: null | {
    finalNote: string;
    facts: { text: string; date: string | null; cite: Cite }[];
    points: { text: string; cite: Cite; quote?: string }[];
    sections: { lawyerDecisions: { question: string; options: { label: string; effect: string }[] }[] };
    selfReview: { passed: boolean; findings: { where: string; problem: string }[] };
    ready: boolean;
  };
};

const EVENT_LABEL: Record<string, string> = {
  supported: "مُسند",
  unsupported: "غير مُسند",
  rejected: "إحالة مرفوضة",
};

const RESEARCH_LABEL: Record<string, string> = {
  usable: "نافذ",
  shown: "معروض بحالته",
  excluded: "مستبعد",
};

function CiteRef({ cite }: { cite: Cite }) {
  if (!cite) return <span className="text-stone-500">بلا إحالة</span>;
  const where = cite.page !== undefined ? `صفحة ${cite.page}` : `فقرة ${cite.paragraph}`;
  return <span className="text-stone-600">[{cite.docId}، {where}]</span>;
}

export default function LegalAgentPreview() {
  const r = runPreviewCase(SYNTHETIC_CASE) as unknown as PreviewResult;

  return (
    <main dir="rtl" className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-stone-900">
      <header className="space-y-2 border-b border-stone-300 pb-4">
        <h1 className="text-2xl font-bold">{SYNTHETIC_CASE.title}</h1>
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">{SYNTHETIC_CASE.banner}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">١. المستندات</h2>
        <ul className="list-disc space-y-1 pr-5">
          {r.index.map((d) => (
            <li key={d.id}>
              {d.name}: {d.status === "readable" ? "مقروء" : d.status === "incomplete" ? "ناقص" : "غير مقروء"}
              {d.date ? ` (تاريخ واحد واضح: ${d.date})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">٢. الجدول الزمني</h2>
        <ol className="list-decimal space-y-1 pr-5">
          {r.timeline.map((e) => (
            <li key={e.id}>
              {e.date ?? "بلا تاريخ"} — {e.text} — <strong>{EVENT_LABEL[e.status]}</strong> <CiteRef cite={e.cite} />
              {e.reason ? <span className="text-stone-500"> ({e.reason})</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">٣. المسائل والأدلة</h2>
        {r.issueTable.map((i) => (
          <div key={i.id} className="space-y-1 rounded border border-stone-200 p-3">
            <h3 className="font-semibold">{i.question}</h3>
            <p className="text-sm">المؤيد:</p>
            <ul className="list-disc pr-5 text-sm">
              {i.supporting.map((p, k) => (
                <li key={k}>{p.text} <CiteRef cite={p.cite} /> — {EVENT_LABEL[p.status]}</li>
              ))}
            </ul>
            <p className="text-sm">المضعِّف:</p>
            <ul className="list-disc pr-5 text-sm">
              {i.opposing.map((p, k) => (
                <li key={k}>{p.text} <CiteRef cite={p.cite} /> — {EVENT_LABEL[p.status]}</li>
              ))}
            </ul>
            {i.actionNeeded ? <p className="text-sm text-stone-700">الإجراء المطلوب: {i.actionNeeded}</p> : null}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">٤. البيانات الناقصة</h2>
        {r.gaps.gaps.length === 0 && r.gaps.openPoints.length === 0 ? <p>لا نقص مسجّل.</p> : null}
        <ul className="list-disc space-y-1 pr-5">
          {r.gaps.gaps.map((g) => (
            <li key={g.id}>
              ناقص: {g.description} {g.decisive ? "(حاسم)" : ""} {g.note ? `— ${g.note}` : ""}
            </li>
          ))}
          {r.gaps.openPoints.map((g) => (
            <li key={g.id}>غير محسوم: {g.description} {g.note ? `— ${g.note}` : ""}</li>
          ))}
        </ul>
        {!r.gaps.canDraft ? <p className="font-semibold text-red-700">توقفت المسودة: يوجد بند حاسم ناقص.</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">٥. السوابق والنصوص</h2>
        {(["usable", "shown", "excluded"] as const).map((group) => {
          const rows = r.research[group];
          if (rows.length === 0) return null;
          return (
            <div key={group}>
              <h3 className="font-semibold">{RESEARCH_LABEL[group]}</h3>
              <ul className="list-disc pr-5 text-sm">
                {rows.map((x) => (
                  <li key={x.id ?? x.title}>
                    {x.title} — {x.label} {x.reason ? `(${x.reason})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">٦. المذكرة الأولية</h2>
        {r.memo === null ? (
          <p>لم تُكتب المذكرة لأن بنداً حاسماً ناقص.</p>
        ) : (
          <>
            <p className="rounded bg-stone-100 p-2 text-sm">{r.memo.finalNote}</p>
            <div>
              <h3 className="font-semibold">الوقائع مع الإحالات</h3>
              <ul className="list-disc pr-5 text-sm">
                {r.memo.facts.map((f, k) => (
                  <li key={k}>{f.date ? `${f.date}: ` : ""}{f.text} <CiteRef cite={f.cite} /></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">الأدلة والاقتباسات</h3>
              <ul className="list-disc pr-5 text-sm">
                {r.memo.points.map((p, k) => (
                  <li key={k}>{p.text} <CiteRef cite={p.cite} /> {p.quote ? `— اقتباس: «${p.quote}»` : ""}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">ما يحتاج قرار المحامي</h3>
              {r.memo.sections.lawyerDecisions.map((d, k) => (
                <div key={k} className="text-sm">
                  <p>{d.question}</p>
                  <ul className="list-disc pr-5">
                    {d.options.map((o, j) => (
                      <li key={j}>{o.label}: {o.effect}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-semibold">سجل المراجعة الذاتية</h3>
              <p className="text-sm">
                {r.memo.selfReview.passed ? "نجحت المراجعة: كل إحالة واقتباس يطابق المصدر." : "فشلت المراجعة:"}
              </p>
              {r.memo.selfReview.findings.map((f, k) => (
                <p key={k} className="text-sm text-red-700">{f.where}: {f.problem}</p>
              ))}
              <p className="text-sm text-stone-600">
                جاهزة للعرض على المحامي: {r.memo.ready ? "نعم" : "لا"}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
