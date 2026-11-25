import { requireEditor } from "@/lib/equivalency/editor";
import { ImportForm } from "./ImportForm";

export const metadata = { title: "استيراد دفعة" };

export default async function ImportPage() {
  await requireEditor();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">استيراد دفعة من الأوراق</h1>
      <p className="mt-2 text-sm leading-7" style={{ color: "var(--cm-muted)" }}>
        اختر ملف الاستيراد (JSON) الذي جهّزه مكوريا من نصوص المسح. تدخل كل ورقة مسودة عليها «تحتاج مراجعة»، ولا
        يراها الطلاب. الورقة التي استُوردت من قبل تُتخطّى، فلا ضرر من تكرار الاستيراد.
      </p>
      <ImportForm />
    </div>
  );
}
