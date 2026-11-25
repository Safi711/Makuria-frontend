"use client";

import { useState } from "react";
import Link from "next/link";
import { importDraft, type ImportItem } from "../actions";

export function ImportForm() {
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setDone(null);
    setLog([]);
    let items: ImportItem[] = [];
    try {
      const data = JSON.parse(await file.text());
      if (data?.format !== "makuria-eq-import/1" || !Array.isArray(data.papers)) throw new Error();
      items = data.papers;
    } catch {
      setLog(["الملف ليس ملف استيراد صالحاً."]);
      setBusy(false);
      return;
    }
    const tally = { created: 0, skipped: 0, failed: 0 };
    for (let i = 0; i < items.length; i++) {
      const r = await importDraft(items[i]);
      if (r === "created") tally.created++;
      else if (r === "skipped") tally.skipped++;
      else {
        tally.failed++;
        setLog((l) => [...l, `${items[i].title_ar ?? items[i].import_key}: ${r}`]);
      }
      setDone({ ...tally });
    }
    setBusy(false);
  }

  return (
    <div className="mt-6 space-y-4">
      <input
        type="file"
        accept="application/json,.json"
        disabled={busy}
        onChange={(e) => run(e.target.files?.[0])}
        className="block w-full text-sm"
      />
      {done && (
        <p className="text-sm" style={{ color: "var(--mk-gold)" }}>
          {busy ? "جارٍ الاستيراد… " : "انتهى: "}
          أُضيفت {done.created}، وتُخطّيت {done.skipped} مستوردة من قبل، وتعذّرت {done.failed}.
        </p>
      )}
      {log.length > 0 && (
        <ul className="list-disc ps-5 text-xs text-red-300">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      {done && !busy && (
        <Link href="/admin/equivalency?status=draft" className="inline-block underline">
          عرض المسودات
        </Link>
      )}
    </div>
  );
}
