import Link from "next/link";
import { requireEditor } from "@/lib/equivalency/editor";
import { COMPLETENESS, PAPER_STATUS, paperTitle, type Completeness, type PaperStatus } from "@/lib/equivalency/labels";

export const metadata = { title: "مرجع المعادلة" };

export default async function AdminEquivalency(props: PageProps<"/admin/equivalency">) {
  const { supabase } = await requireEditor();
  const sp = await props.searchParams;
  const subjectSlug = typeof sp.subject === "string" ? sp.subject : undefined;
  const status = typeof sp.status === "string" && sp.status in PAPER_STATUS ? sp.status : undefined;

  const { data: subjects } = await supabase.from("eq_subjects").select("id, slug, name_ar").order("display_order");
  const subject = subjects?.find((s) => s.slug === subjectSlug);

  let q = supabase
    .from("eq_papers")
    .select("id, subject_id, exam_year, session_month, title_ar, status, completeness, needs_review, updated_at, eq_questions(count)")
    .order("exam_year", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (subject) q = q.eq("subject_id", subject.id);
  if (status) q = q.eq("status", status);
  const { data: papers, error } = await q;

  const nameOf = new Map((subjects ?? []).map((s) => [s.id, s.name_ar]));
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ subject: subjectSlug, status, ...o })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">مرجع المعادلة</h1>
        <Link
          href="/admin/equivalency/new"
          className="rounded-md px-4 py-2 text-sm font-bold"
          style={{ background: "var(--mk-gold)", color: "#071226" }}
        >
          إضافة امتحان سابق
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <Link href={`/admin/equivalency${qs({ subject: undefined })}`} className="rounded-full border px-3 py-1"
          style={{ borderColor: !subject ? "var(--mk-gold)" : "var(--mk-border)" }}>كل المواد</Link>
        {(subjects ?? []).map((s) => (
          <Link key={s.id} href={`/admin/equivalency${qs({ subject: s.slug })}`} className="rounded-full border px-3 py-1"
            style={{ borderColor: subject?.id === s.id ? "var(--mk-gold)" : "var(--mk-border)" }}>
            {s.name_ar}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Link href={`/admin/equivalency${qs({ status: undefined })}`} className="rounded-full border px-3 py-1"
          style={{ borderColor: !status ? "var(--mk-gold)" : "var(--mk-border)" }}>كل الحالات</Link>
        {Object.entries(PAPER_STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/equivalency${qs({ status: k })}`} className="rounded-full border px-3 py-1"
            style={{ borderColor: status === k ? "var(--mk-gold)" : "var(--mk-border)" }}>{v}</Link>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-red-400">{error.message}</p>}

      <p className="mt-6 text-xs" style={{ color: "var(--cm-muted)" }}>{papers?.length ?? 0} ورقة</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-right text-xs" style={{ color: "var(--cm-muted)" }}>
              <th className="py-2 font-medium">الورقة</th>
              <th className="py-2 font-medium">المادة</th>
              <th className="py-2 font-medium">الأسئلة</th>
              <th className="py-2 font-medium">الاكتمال</th>
              <th className="py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(papers ?? []).map((p) => {
              const n = (p.eq_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
              return (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--mk-border)" }}>
                  <td className="py-2">
                    <Link href={`/admin/equivalency/papers/${p.id}`} className="hover:text-[var(--mk-gold)]">
                      {paperTitle(p)}
                    </Link>
                    {p.needs_review && (
                      <span className="ms-2 rounded px-1.5 py-0.5 text-[10px]"
                        style={{ background: "var(--mk-unverified-bg)", color: "var(--mk-unverified-fg)" }}>
                        تحتاج مراجعة
                      </span>
                    )}
                  </td>
                  <td className="py-2">{nameOf.get(p.subject_id)}</td>
                  <td className="py-2">{n}</td>
                  <td className="py-2">{COMPLETENESS[p.completeness as Completeness]}</td>
                  <td className="py-2" style={{ color: p.status === "published" ? "var(--mk-gold)" : undefined }}>
                    {PAPER_STATUS[p.status as PaperStatus]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
