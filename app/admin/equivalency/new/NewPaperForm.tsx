"use client";

import { useState } from "react";
import { createPaper } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { ocrFiles } from "@/lib/equivalency/ocr-client";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--mk-border)", background: "var(--cm-surface-2)" };

export function NewPaperForm({
  subjects,
  months,
}: {
  subjects: { id: string; name_ar: string }[];
  months: string[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(list: File[]) {
    const supabase = createClient();
    const out: string[] = [];
    for (const f of list) {
      const safe = f.name.replace(/[^\w.-]+/g, "_").slice(-100) || "page";
      const path = `${crypto.randomUUID()}/${safe}`;
      const { error } = await supabase.storage.from("eq-originals").upload(path, f, { contentType: f.type });
      if (error) throw new Error(`تعذّر رفع ${f.name}: ${error.message}`);
      out.push(path);
    }
    return out;
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const arr = [...list];
    setFiles(arr);
    setErr(null);
    try {
      setBusy("رفع الأصل…");
      setPaths(await upload(arr));
      setBusy(null);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  async function runOcr() {
    setErr(null);
    try {
      const t = await ocrFiles(files, (msg) => setBusy(msg));
      setText((prev) => (prev ? prev + "\n\n" : "") + t);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form action={createPaper} className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          المادة
          <select name="subject_id" required className={field} style={fieldStyle} defaultValue="">
            <option value="" disabled>اختر</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name_ar}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          الدورة
          <select name="session_month" className={field} style={fieldStyle} defaultValue="">
            <option value="">—</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          السنة
          <input name="exam_year" type="number" inputMode="numeric" min={1990} max={2100} className={field} style={fieldStyle} />
        </label>
      </div>

      <label className="block text-sm">
        عنوان اختياري
        <input name="title_ar" className={field} style={fieldStyle} placeholder="يُترك فارغاً ليُكتب «دورة فبراير 2009» تلقائياً" />
      </label>
      <label className="block text-sm">
        مصدر النسخة
        <input name="source_note" className={field} style={fieldStyle} placeholder="مثلاً: نسخة مطبوعة من أرشيف صافي" />
      </label>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--mk-border)" }}>
        <p className="text-sm font-bold">صور الورقة أو ملف PDF</p>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="mt-2 block w-full text-sm"
          onChange={(e) => onFiles(e.target.files)}
        />
        {paths.map((p) => (
          <input key={p} type="hidden" name="original_paths" value={p} />
        ))}
        {paths.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--cm-muted)" }}>رُفع {paths.length} ملف (خاص بالمحررين).</p>
        )}
        <button
          type="button"
          disabled={!files.length || !!busy}
          onClick={runOcr}
          className="mt-3 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          style={{ borderColor: "var(--mk-gold)" }}
        >
          استخراج النص
        </button>
        {busy && <p className="mt-2 text-xs" style={{ color: "var(--mk-gold)" }}>{busy}</p>}
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      </div>

      <label className="block text-sm">
        نص الورقة
        <textarea
          name="ocr_text"
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={field + " leading-7"}
          style={fieldStyle}
          placeholder="يظهر هنا النص المستخرج، أو الصقه أو اكتبه يدوياً"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="split" defaultChecked />
        قسّم النص إلى أسئلة تلقائياً عند «السؤال الأول، الثاني…»
      </label>

      <button
        type="submit"
        disabled={!!busy}
        className="rounded-md px-5 py-2 text-sm font-bold disabled:opacity-50"
        style={{ background: "var(--mk-gold)", color: "#071226" }}
      >
        حفظ كمسودة
      </button>
    </form>
  );
}
