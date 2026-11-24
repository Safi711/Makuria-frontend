import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/equivalency/editor";
import {
  COMPLETENESS,
  PAPER_STATUS,
  QTYPE,
  REVIEW_STATUS,
  SESSION_MONTHS,
  SOLUTION_KIND,
  SOLUTION_PARTS,
  paperTitle,
  type PaperStatus,
} from "@/lib/equivalency/labels";
import {
  addCitation,
  addQuestion,
  deleteCitation,
  deletePaper,
  deleteQuestion,
  deleteSolution,
  saveSolution,
  setPaperStatus,
  splitPaper,
  updatePaper,
  updateQuestion,
} from "../../actions";

export const metadata = { title: "تحرير ورقة" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";
const fs = { borderColor: "var(--mk-border)", background: "var(--cm-surface-2)" };
const card = "rounded-xl border p-4";
const cs = { borderColor: "var(--mk-border)", background: "var(--cm-surface)" };
const btn = "rounded-md border px-3 py-1.5 text-sm";
const gold = "rounded-md px-4 py-2 text-sm font-bold";
const goldS = { background: "var(--mk-gold)", color: "#071226" };

type Sol = {
  id: string;
  kind: string;
  review_status: string;
  issue_ar: string | null;
  rules_ar: string | null;
  application_ar: string | null;
  conclusion_ar: string | null;
  author_name: string | null;
  external_source: string | null;
  permission_note: string | null;
  eq_citations: { id: string; article_label: string | null; law_slug: string | null; article_id: string | null; note_ar: string | null; position: number }[];
};

export default async function EditPaper(props: PageProps<"/admin/equivalency/papers/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const err = typeof sp.err === "string" ? sp.err : null;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireEditor();

  const { data: paper } = await supabase
    .from("eq_papers")
    .select("id, subject_id, exam_year, session_month, title_ar, status, completeness, completeness_note, source_note, needs_review, eq_subjects(slug, name_ar, law_slugs)")
    .eq("id", id)
    .maybeSingle();
  if (!paper) notFound();
  const subject = paper.eq_subjects as unknown as { slug: string; name_ar: string; law_slugs: string[] } | null;

  const [{ data: internal }, { data: subjects }, { data: topics }, { data: questions }] = await Promise.all([
    supabase.from("eq_paper_internal").select("ocr_text, review_note, original_paths").eq("paper_id", id).maybeSingle(),
    supabase.from("eq_subjects").select("id, name_ar").order("display_order"),
    supabase.from("eq_topics").select("id, name_ar").eq("subject_id", paper.subject_id).order("display_order"),
    supabase
      .from("eq_questions")
      .select("id, position, label_ar, qtype, is_compulsory, marks, body_ar, topic_id, text_verified, eq_solutions(id, kind, review_status, issue_ar, rules_ar, application_ar, conclusion_ar, author_name, external_source, permission_note, eq_citations(id, article_label, law_slug, article_id, note_ar, position))")
      .eq("paper_id", id)
      .order("position"),
  ]);

  const originals = internal?.original_paths ?? [];
  const { data: signed } = originals.length
    ? await supabase.storage.from("eq-originals").createSignedUrls(originals, 3600)
    : { data: [] };

  const lawSlugs = subject?.law_slugs ?? [];

  return (
    <div className="space-y-8">
      {err && (
        <p role="alert" className="rounded-md border border-red-400 p-3 text-sm text-red-300">{err}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs" style={{ color: "var(--cm-muted)" }}>{subject?.name_ar}</p>
          <h1 className="text-2xl font-bold">{paperTitle(paper)}</h1>
          <p className="mt-1 text-sm" style={{ color: paper.status === "published" ? "var(--mk-gold)" : "var(--cm-muted)" }}>
            {PAPER_STATUS[paper.status as PaperStatus]}
            {paper.status === "published" && (
              <>
                {" · "}
                <Link href={`/equivalency/papers/${paper.id}`} className="underline">عرضها كما يراها الطالب</Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {paper.status !== "published" ? (
            <form action={setPaperStatus}>
              <input type="hidden" name="paper_id" value={paper.id} />
              <input type="hidden" name="status" value="published" />
              <button className={gold} style={goldS}>نشر الورقة</button>
            </form>
          ) : (
            <form action={setPaperStatus}>
              <input type="hidden" name="paper_id" value={paper.id} />
              <input type="hidden" name="status" value="draft" />
              <button className={btn} style={{ borderColor: "var(--mk-border)" }}>إلغاء النشر</button>
            </form>
          )}
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--cm-muted)" }}>
        نشر الورقة يُظهر أسئلتها للطلاب. كل حل يُنشر وحده من بطاقته، فلا يظهر حل لم تعتمده.
      </p>

      {/* ------------------------------------------------ paper details */}
      <details className={card} style={cs} open={paper.needs_review}>
        <summary className="cursor-pointer font-bold">بيانات الورقة والنص المستخرج</summary>
        <form action={updatePaper} className="mt-4 space-y-4">
          <input type="hidden" name="paper_id" value={paper.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">المادة
              <select name="subject_id" defaultValue={paper.subject_id} className={field} style={fs}>
                {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              </select>
            </label>
            <label className="block text-sm">الدورة
              <select name="session_month" defaultValue={paper.session_month ?? ""} className={field} style={fs}>
                <option value="">—</option>
                {SESSION_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-sm">السنة
              <input name="exam_year" type="number" defaultValue={paper.exam_year ?? ""} className={field} style={fs} />
            </label>
          </div>
          <label className="block text-sm">العنوان
            <input name="title_ar" defaultValue={paper.title_ar ?? ""} className={field} style={fs} />
          </label>
          <label className="block text-sm">مصدر النسخة (يظهر للطالب)
            <input name="source_note" defaultValue={paper.source_note ?? ""} className={field} style={fs} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">الاكتمال
              <select name="completeness" defaultValue={paper.completeness} className={field} style={fs}>
                {Object.entries(COMPLETENESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">ملاحظة الاكتمال (تظهر للطالب)
              <input name="completeness_note" defaultValue={paper.completeness_note ?? ""} className={field} style={fs}
                placeholder="مثلاً: الصفحة الثانية مفقودة" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="needs_review" defaultChecked={paper.needs_review} /> تحتاج مراجعة
          </label>
          <label className="block text-sm">ملاحظات المراجعة (للمحررين فقط)
            <textarea name="review_note" rows={3} defaultValue={internal?.review_note ?? ""} className={field} style={fs} />
          </label>
          <label className="block text-sm">النص المستخرج (للمحررين فقط)
            <textarea name="ocr_text" rows={14} defaultValue={internal?.ocr_text ?? ""} className={field + " leading-7"} style={fs} />
          </label>
          <button className={gold} style={goldS}>حفظ البيانات</button>
        </form>

        {signed && signed.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-bold">الأصل الممسوح</p>
            <ul className="mt-2 flex flex-wrap gap-3 text-sm">
              {signed.map((s, i) => s.signedUrl && (
                <li key={i}><a href={s.signedUrl} target="_blank" rel="noreferrer" className="underline">ملف {i + 1}</a></li>
              ))}
            </ul>
          </div>
        )}
      </details>

      {/* ------------------------------------------------ questions */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">الأسئلة ({questions?.length ?? 0})</h2>
          {(!questions || questions.length === 0) && (
            <form action={splitPaper}>
              <input type="hidden" name="paper_id" value={paper.id} />
              <button className={btn} style={{ borderColor: "var(--mk-gold)" }}>قسّم النص المستخرج إلى أسئلة</button>
            </form>
          )}
        </div>

        <ol className="mt-4 space-y-6">
          {(questions ?? []).map((q) => {
            const sols = (q.eq_solutions ?? []) as unknown as Sol[];
            return (
              <li key={q.id} className={card} style={cs}>
                <form action={updateQuestion} className="space-y-3">
                  <input type="hidden" name="paper_id" value={paper.id} />
                  <input type="hidden" name="question_id" value={q.id} />
                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="block text-sm sm:col-span-2">العنوان
                      <input name="label_ar" defaultValue={q.label_ar ?? ""} className={field} style={fs} />
                    </label>
                    <label className="block text-sm">النوع
                      <select name="qtype" defaultValue={q.qtype} className={field} style={fs}>
                        {Object.entries(QTYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm">الدرجة
                      <input name="marks" type="number" step="0.5" defaultValue={q.marks ?? ""} className={field} style={fs} />
                    </label>
                  </div>
                  <label className="block text-sm">الموضوع
                    <select name="topic_id" defaultValue={q.topic_id ?? ""} className={field} style={fs}>
                      <option value="">—</option>
                      {(topics ?? []).map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm">نص السؤال
                    <textarea name="body_ar" rows={6} defaultValue={q.body_ar} className={field + " leading-7"} style={fs} />
                  </label>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="is_compulsory" defaultChecked={q.is_compulsory} /> إجباري
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="text_verified" defaultChecked={q.text_verified} /> قابلت أرقام المواد والتواريخ بالأصل
                    </label>
                    <button className={btn} style={{ borderColor: "var(--mk-gold)" }}>حفظ السؤال</button>
                  </div>
                </form>
                <form action={deleteQuestion} className="mt-2">
                  <input type="hidden" name="paper_id" value={paper.id} />
                  <input type="hidden" name="question_id" value={q.id} />
                  <button className="text-xs text-red-400 underline">حذف السؤال وحلوله</button>
                </form>

                {/* solutions */}
                <div className="mt-5 space-y-4">
                  {sols.map((s) => <SolutionEditor key={s.id} paperId={paper.id} questionId={q.id} s={s} lawSlugs={lawSlugs} />)}
                  <details>
                    <summary className="cursor-pointer text-sm" style={{ color: "var(--mk-gold)" }}>+ إضافة حل</summary>
                    <SolutionEditor paperId={paper.id} questionId={q.id} lawSlugs={lawSlugs} />
                  </details>
                </div>
              </li>
            );
          })}
        </ol>

        <details className={card + " mt-6"} style={cs}>
          <summary className="cursor-pointer text-sm font-bold">+ إضافة سؤال يدوياً</summary>
          <form action={addQuestion} className="mt-3 space-y-3">
            <input type="hidden" name="paper_id" value={paper.id} />
            <input name="label_ar" placeholder="السؤال …" className={field} style={fs} />
            <textarea name="body_ar" rows={4} required className={field} style={fs} />
            <button className={btn} style={{ borderColor: "var(--mk-gold)" }}>إضافة</button>
          </form>
        </details>
      </section>

      {paper.status !== "published" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-red-400">حذف الورقة</summary>
          <form action={deletePaper} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="paper_id" value={paper.id} />
            <input name="confirm" placeholder="اكتب: حذف" className="rounded-md border px-2 py-1" style={fs} />
            <button className="rounded-md border border-red-400 px-3 py-1 text-red-400">حذف نهائي</button>
          </form>
        </details>
      )}
    </div>
  );
}

function SolutionEditor({
  paperId,
  questionId,
  s,
  lawSlugs,
}: {
  paperId: string;
  questionId: string;
  s?: Sol;
  lawSlugs: string[];
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--mk-border)" }}>
      <form action={saveSolution} className="space-y-3">
        <input type="hidden" name="paper_id" value={paperId} />
        <input type="hidden" name="question_id" value={questionId} />
        {s && <input type="hidden" name="solution_id" value={s.id} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">نوع الحل
            <select name="kind" defaultValue={s?.kind ?? "makuria"} className={field} style={fs}>
              {Object.entries(SOLUTION_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-sm">حالة المراجعة
            <select name="review_status" defaultValue={s?.review_status ?? "draft"} className={field} style={fs}>
              {Object.entries(REVIEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-sm">الكاتب
            <input name="author_name" defaultValue={s?.author_name ?? ""} className={field} style={fs} />
          </label>
        </div>
        {SOLUTION_PARTS.map(({ key, label }) => (
          <label key={key} className="block text-sm">{label}
            <textarea name={key} rows={key === "application_ar" ? 6 : 3} defaultValue={s?.[key] ?? ""} className={field + " leading-7"} style={fs} />
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">المصدر الخارجي (للحل الخارجي)
            <input name="external_source" defaultValue={s?.external_source ?? ""} className={field} style={fs} />
          </label>
          <label className="block text-sm">إذن النشر (متى ومن)
            <input name="permission_note" defaultValue={s?.permission_note ?? ""} className={field} style={fs} />
          </label>
        </div>
        <button className={gold} style={goldS}>{s ? "حفظ الحل" : "إضافة الحل"}</button>
      </form>

      {s && (
        <>
          <div className="mt-4">
            <p className="text-sm font-bold">المواد المستشهد بها</p>
            <ul className="mt-2 space-y-1 text-sm">
              {[...s.eq_citations].sort((a, b) => a.position - b.position).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span>{c.article_label}</span>
                  <span className="text-xs" style={{ color: c.article_id ? "var(--mk-verified-fg)" : "var(--mk-unverified-fg)" }}>
                    {c.article_id ? `مرتبطة بنص ${c.law_slug}` : "غير مرتبطة بنص في المكتبة"}
                  </span>
                  <form action={deleteCitation}>
                    <input type="hidden" name="paper_id" value={paperId} />
                    <input type="hidden" name="citation_id" value={c.id} />
                    <button className="text-xs text-red-400 underline">حذف</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addCitation} className="mt-2 grid gap-2 sm:grid-cols-5">
              <input type="hidden" name="paper_id" value={paperId} />
              <input type="hidden" name="solution_id" value={s.id} />
              <input name="law_slug" list={`laws-${s.id}`} defaultValue={lawSlugs[0] ?? ""} placeholder="القانون" className={field + " sm:col-span-2"} style={fs} />
              <datalist id={`laws-${s.id}`}>{lawSlugs.map((l) => <option key={l} value={l} />)}</datalist>
              <input name="article_number" placeholder="رقم المادة" className={field} style={fs} />
              <input name="article_label" placeholder="كما يُكتب: م58(1)" className={field} style={fs} />
              <button className={btn} style={{ borderColor: "var(--mk-gold)" }}>ربط</button>
              <input name="note_ar" placeholder="ملاحظة: نص المادة وقت الامتحان إن اختلف" className={field + " sm:col-span-5"} style={fs} />
            </form>
          </div>
          <form action={deleteSolution} className="mt-3">
            <input type="hidden" name="paper_id" value={paperId} />
            <input type="hidden" name="solution_id" value={s.id} />
            <button className="text-xs text-red-400 underline">حذف الحل</button>
          </form>
        </>
      )}
    </div>
  );
}
