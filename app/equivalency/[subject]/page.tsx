import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { COMPLETENESS, paperTitle, type Completeness } from "@/lib/equivalency/labels";

export async function generateMetadata(props: PageProps<"/equivalency/[subject]">): Promise<Metadata> {
  const { subject } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("eq_subjects").select("name_ar").eq("slug", subject).maybeSingle();
  if (!data) return { title: "مرجع المعادلة" };
  return {
    title: `${data.name_ar} — امتحانات المعادلة السابقة`,
    description: `أوراق امتحان تنظيم مهنة القانون في مادة ${data.name_ar} مرتبة حسب الدورة، مع الحلول.`,
    alternates: { canonical: `/equivalency/${subject}` },
  };
}

export default async function SubjectPage(props: PageProps<"/equivalency/[subject]">) {
  const { subject: slug } = await props.params;
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("eq_subjects")
    .select("id, slug, name_ar, description_ar, law_slugs")
    .eq("slug", slug)
    .maybeSingle();
  if (!subject) notFound();

  const { data: papers } = await supabase
    .from("eq_papers")
    .select("id, exam_year, session_month, title_ar, completeness")
    .eq("subject_id", subject.id)
    .eq("status", "published")
    .order("exam_year", { ascending: false, nullsFirst: false });

  const { data: laws } = subject.law_slugs?.length
    ? await supabase.from("laws").select("slug, title_ar").in("slug", subject.law_slugs)
    : { data: [] as { slug: string; title_ar: string }[] };

  const byYear = new Map<string, typeof papers>();
  for (const p of papers ?? []) {
    const k = p.exam_year ? String(p.exam_year) : "بلا تاريخ";
    if (!byYear.has(k)) byYear.set(k, []);
    byYear.get(k)!.push(p);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <nav className="text-xs" style={{ color: "var(--cm-muted)" }}>
        <Link href="/equivalency" className="hover:text-[var(--mk-gold)]">
          مرجع المعادلة
        </Link>{" "}
        / {subject.name_ar}
      </nav>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{subject.name_ar}</h1>

      {laws && laws.length > 0 && (
        <p className="mt-3 text-sm" style={{ color: "var(--cm-text-2)" }}>
          النص في مكتبة مكوريا:{" "}
          {laws.map((l, i) => (
            <span key={l.slug}>
              {i > 0 && "، "}
              <Link href={`/laws/${l.slug}`} className="underline hover:text-[var(--mk-gold)]">
                {l.title_ar}
              </Link>
            </span>
          ))}
        </p>
      )}

      {/* The mock exam is phase 3; the entry point is here so students know it's coming. */}
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        style={{ borderColor: "rgba(228,193,67,0.45)", background: "rgba(228,193,67,0.06)" }}
      >
        <div>
          <p className="font-bold">امتحنّي في {subject.name_ar}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--cm-muted)" }}>
            امتحان تجريبي يصحّحه أبو رنات ويربط ملاحظاته بالأسئلة المحلولة. قريباً.
          </p>
        </div>
        <span
          aria-disabled="true"
          className="cursor-not-allowed rounded-md px-4 py-2 text-sm font-bold opacity-60"
          style={{ background: "var(--mk-gold)", color: "#071226" }}
        >
          قريباً
        </span>
      </div>

      <h2 className="mt-10 text-lg font-bold">الدورات السابقة</h2>
      {byYear.size === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--cm-muted)" }}>
          لم تُنشر أوراق هذه المادة بعد. تُنشر الورقة بعد أن يقابلها محرر بالأصل.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {[...byYear.entries()].map(([year, list]) => (
            <section key={year}>
              <h3 className="text-sm font-bold" style={{ color: "var(--mk-gold)" }}>
                {year}
              </h3>
              <ul className="mt-2 divide-y [&>li]:border-[var(--mk-border)]">
                {list!.map((p) => (
                  <li key={p.id} className="py-3">
                    <Link
                      href={`/equivalency/papers/${p.id}`}
                      className="flex items-center justify-between gap-3 hover:text-[var(--mk-gold)]"
                    >
                      <span>{paperTitle(p)}</span>
                      {p.completeness !== "complete" && p.completeness !== "unknown" && (
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{ background: "var(--mk-unverified-bg)", color: "var(--mk-unverified-fg)" }}
                        >
                          {COMPLETENESS[p.completeness as Completeness]}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
