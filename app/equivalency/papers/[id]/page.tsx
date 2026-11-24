import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  COMPLETENESS,
  QTYPE,
  SOLUTION_KIND,
  SOLUTION_PARTS,
  paperTitle,
  type Completeness,
  type QType,
  type SolutionKind,
} from "@/lib/equivalency/labels";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPaper(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  // RLS returns nothing for a draft unless the caller is an editor; the
  // explicit status filter makes this page student-only even for editors,
  // who preview drafts from the admin panel instead.
  const { data } = await supabase
    .from("eq_papers")
    .select("id, exam_year, session_month, title_ar, completeness, completeness_note, source_note, eq_subjects(slug, name_ar)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data ? { supabase, paper: data } : null;
}

export async function generateMetadata(props: PageProps<"/equivalency/papers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const res = await loadPaper(id);
  if (!res) return { title: "مرجع المعادلة" };
  const subj = res.paper.eq_subjects as unknown as { name_ar: string } | null;
  return {
    title: `${subj?.name_ar ?? ""} — ${paperTitle(res.paper)}`,
    alternates: { canonical: `/equivalency/papers/${id}` },
  };
}

type Citation = {
  id: string;
  article_label: string | null;
  law_slug: string | null;
  note_ar: string | null;
  position: number;
  articles: { article_number: string | null; content_ar: string | null; legal_status: string | null } | null;
};

export default async function PaperPage(props: PageProps<"/equivalency/papers/[id]">) {
  const { id } = await props.params;
  const res = await loadPaper(id);
  if (!res) notFound();
  const { supabase, paper } = res;
  const subject = paper.eq_subjects as unknown as { slug: string; name_ar: string } | null;

  const { data: questions } = await supabase
    .from("eq_questions")
    .select("id, position, label_ar, qtype, is_compulsory, marks, body_ar")
    .eq("paper_id", paper.id)
    .order("position");

  const qIds = (questions ?? []).map((q) => q.id);
  const { data: solutions } = qIds.length
    ? await supabase
        .from("eq_solutions")
        .select(
          "id, question_id, kind, issue_ar, rules_ar, application_ar, conclusion_ar, author_name, external_source, reviewed_at, eq_citations(id, article_label, law_slug, note_ar, position, articles(article_number, content_ar, legal_status))",
        )
        .in("question_id", qIds)
        .eq("review_status", "published")
    : { data: null };

  type Sol = NonNullable<typeof solutions>[number];
  const solByQ = new Map<string, Sol[]>();
  for (const s of solutions ?? []) {
    if (!solByQ.has(s.question_id)) solByQ.set(s.question_id, []);
    solByQ.get(s.question_id)!.push(s);
  }
  const kindOrder: SolutionKind[] = ["official", "makuria", "external"];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-xs" style={{ color: "var(--cm-muted)" }}>
        <Link href="/equivalency" className="hover:text-[var(--mk-gold)]">
          مرجع المعادلة
        </Link>
        {subject && (
          <>
            {" / "}
            <Link href={`/equivalency/${subject.slug}`} className="hover:text-[var(--mk-gold)]">
              {subject.name_ar}
            </Link>
          </>
        )}
      </nav>
      <h1 className="mt-2 text-2xl font-bold">
        {subject?.name_ar} — {paperTitle(paper)}
      </h1>

      {paper.completeness !== "complete" && paper.completeness !== "unknown" && (
        <p
          className="mt-4 rounded-md p-3 text-sm"
          style={{ background: "var(--mk-unverified-bg)", color: "var(--mk-unverified-fg)" }}
        >
          {COMPLETENESS[paper.completeness as Completeness]}
          {paper.completeness_note ? `: ${paper.completeness_note}` : ""}
        </p>
      )}

      <ol className="mt-8 space-y-10">
        {(questions ?? []).map((q) => {
          const sols = (solByQ.get(q.id) ?? []).sort(
            (a, b) => kindOrder.indexOf(a.kind as SolutionKind) - kindOrder.indexOf(b.kind as SolutionKind),
          );
          return (
            <li key={q.id} id={`q-${q.position}`} className="scroll-mt-24">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold" style={{ color: "var(--mk-gold)" }}>
                  {q.label_ar || `السؤال ${q.position}`}
                </h2>
                <span className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: "var(--mk-border)" }}>
                  {QTYPE[q.qtype as QType]}
                </span>
                {q.is_compulsory && (
                  <span className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: "var(--mk-border)" }}>
                    إجباري
                  </span>
                )}
                {q.marks != null && (
                  <span className="text-xs" style={{ color: "var(--cm-muted)" }}>
                    {q.marks} درجة
                  </span>
                )}
              </div>
              <div className="mt-3 whitespace-pre-wrap leading-8">{q.body_ar}</div>

              {sols.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: "var(--cm-muted)" }}>
                  لم يُنشر حل هذا السؤال بعد.
                </p>
              ) : (
                sols.map((s) => (
                  <details
                    key={s.id}
                    className="mt-4 rounded-xl border p-4"
                    style={{ borderColor: "var(--mk-border)", background: "var(--cm-surface)" }}
                  >
                    <summary className="cursor-pointer font-bold">
                      {SOLUTION_KIND[s.kind as SolutionKind]}
                      {s.kind === "external" && s.external_source ? ` — ${s.external_source}` : ""}
                    </summary>
                    {s.kind === "makuria" && (
                      <p className="mt-2 text-xs" style={{ color: "var(--cm-muted)" }}>
                        حل استرشادي للتدريب، راجعه محرر مكوريا
                        {s.reviewed_at ? ` في ${new Date(s.reviewed_at).toLocaleDateString("ar-SD")}` : ""}. ليس
                        نموذج الإجابة الرسمي.
                      </p>
                    )}
                    {SOLUTION_PARTS.map(({ key, label }) =>
                      s[key] ? (
                        <section key={key} className="mt-4">
                          <h3 className="text-sm font-bold" style={{ color: "var(--mk-gold-soft)" }}>
                            {label}
                          </h3>
                          <div className="mt-1 whitespace-pre-wrap text-sm leading-7">{s[key]}</div>
                        </section>
                      ) : null,
                    )}
                    {Array.isArray(s.eq_citations) && s.eq_citations.length > 0 && (
                      <section className="mt-4">
                        <h3 className="text-sm font-bold" style={{ color: "var(--mk-gold-soft)" }}>
                          المواد المستشهد بها
                        </h3>
                        <ul className="mt-2 space-y-2 text-sm">
                          {(s.eq_citations as unknown as Citation[])
                            .sort((a, b) => a.position - b.position)
                            .map((c) => (
                              <li key={c.id}>
                                <details>
                                  <summary className="cursor-pointer">
                                    {c.article_label}
                                    {c.law_slug && (
                                      <>
                                        {" — "}
                                        <Link href={`/laws/${c.law_slug}`} className="underline">
                                          النص في المكتبة
                                        </Link>
                                      </>
                                    )}
                                  </summary>
                                  {c.articles?.content_ar && (
                                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6" style={{ color: "var(--cm-text-2)" }}>
                                      <span className="font-bold">النص الحالي في مكوريا: </span>
                                      {c.articles.content_ar}
                                    </p>
                                  )}
                                  {c.note_ar && (
                                    <p className="mt-1 text-xs" style={{ color: "var(--mk-unverified-fg)" }}>
                                      {c.note_ar}
                                    </p>
                                  )}
                                </details>
                              </li>
                            ))}
                        </ul>
                      </section>
                    )}
                  </details>
                ))
              )}
            </li>
          );
        })}
      </ol>

      {paper.source_note && (
        <p className="mt-10 text-xs" style={{ color: "var(--cm-faint)" }}>
          مصدر الورقة: {paper.source_note}
        </p>
      )}
    </div>
  );
}
