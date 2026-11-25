import { requireEditor } from "@/lib/equivalency/editor";
import { SESSION_MONTHS } from "@/lib/equivalency/labels";
import { NewPaperForm } from "./NewPaperForm";

export const metadata = { title: "إضافة امتحان سابق" };

export default async function NewPaperPage(props: PageProps<"/admin/equivalency/new">) {
  const { supabase } = await requireEditor();
  const sp = await props.searchParams;
  const err = typeof sp.err === "string" ? sp.err : null;
  const { data: subjects } = await supabase.from("eq_subjects").select("id, name_ar").order("display_order");
  return (
    <div className="max-w-3xl">
      {err && <p role="alert" className="mb-4 rounded-md border border-red-400 p-3 text-sm text-red-300">{err}</p>}
      <h1 className="text-2xl font-bold">إضافة امتحان سابق</h1>
      <p className="mt-2 text-sm leading-7" style={{ color: "var(--cm-muted)" }}>
        ارفع صور الورقة أو ملف PDF الممسوح، ثم اضغط «استخراج النص». الحروف العربية تُقرأ جيداً، أما أرقام
        المواد والتواريخ فكثيراً ما تخطئ، فقابلها بالأصل قبل النشر. تُحفظ الورقة مسودة لا يراها الطلاب.
      </p>
      <NewPaperForm subjects={subjects ?? []} months={[...SESSION_MONTHS]} />
    </div>
  );
}
