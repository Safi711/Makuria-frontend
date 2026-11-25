import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "مرجع المعادلة القانونية",
  description:
    "امتحانات تنظيم مهنة القانون السابقة في السودان مرتبة حسب المادة والدورة، مع حلول استرشادية مرتبطة بنصوص القوانين في مكوريا.",
  alternates: { canonical: "/equivalency" },
};

export default async function EquivalencyHome() {
  const supabase = await createClient();
  const { data: subjects } = await supabase
    .from("eq_subjects")
    .select("id, slug, name_ar, description_ar, display_order")
    .order("display_order");

  // Published papers only — RLS hides drafts from everyone who isn't an editor,
  // and the explicit filter keeps the counts honest for editors too.
  const { data: papers } = await supabase
    .from("eq_papers")
    .select("id, subject_id")
    .eq("status", "published");
  const counts = new Map<string, number>();
  for (const p of papers ?? []) counts.set(p.subject_id, (counts.get(p.subject_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-bold" style={{ color: "var(--mk-gold)" }}>
        امتحان تنظيم مهنة القانون
      </p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">مرجع المعادلة القانونية</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--cm-text-2)" }}>
        اختر المادة، ثم اقرأ أوراق الدورات السابقة وحلولها. كل حل يبيّن نوعه: رسمي، أو استرشادي من
        مكوريا راجعه محرر، أو منشور من مصدر خارجي بإذن صاحبه. والمواد المستشهد بها تفتح نصها في
        مكتبة مكوريا.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {(subjects ?? []).map((s) => {
          const n = counts.get(s.id) ?? 0;
          return (
            <li key={s.id}>
              <Link
                href={`/equivalency/${s.slug}`}
                className="block h-full rounded-xl border p-5 transition hover:border-[var(--mk-gold)]"
                style={{ borderColor: "var(--mk-border)", background: "var(--cm-surface)" }}
              >
                <p className="text-lg font-bold">{s.name_ar}</p>
                <p className="mt-2 text-xs" style={{ color: "var(--cm-muted)" }}>
                  {n > 0 ? `${n} ${n === 1 ? "ورقة منشورة" : "أوراق منشورة"}` : "لم تُنشر أوراق بعد"}
                </p>
                {s.description_ar && (
                  <p className="mt-2 text-sm" style={{ color: "var(--cm-text-2)" }}>
                    {s.description_ar}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {(!subjects || subjects.length === 0) && (
        <p className="mt-8 text-sm" style={{ color: "var(--cm-muted)" }}>
          المرجع قيد الإعداد.
        </p>
      )}
    </div>
  );
}
