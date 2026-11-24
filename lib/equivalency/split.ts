// Split the OCR text of a paper into questions on «السؤال الأول/الثاني…»
// headings. OCR garbles these words often (الرايع، الثالت، الخاومس), so the
// match is loose; anything before the first heading (the paper's header and
// instructions) is dropped from the questions and stays in the OCR text.
// The result is a starting point the editor corrects, never final text.

import type { QType } from "./labels";

const HEADING = /^[^\S\n]*[‎‏]*\s*(?:ال)?س[ؤو]ّ?ال\s+(?:ال)?[ء-ي]{2,9}[^\n]{0,40}/gm;

export type SplitPart = { label: string; body: string; qtype: QType; compulsory: boolean };

export function splitQuestions(text: string): SplitPart[] {
  const src = (text || "").replace(/\r/g, "");
  const marks: { index: number; label: string }[] = [];
  for (const m of src.matchAll(HEADING)) {
    const label = m[0].replace(/[‎‏]/g, "").trim().split(/[:：\-–(]/)[0].trim();
    marks.push({ index: m.index ?? 0, label: label.slice(0, 60) });
  }
  if (marks.length === 0) {
    const body = src.trim();
    return body ? [{ label: "السؤال", body, qtype: guessType(body), compulsory: false }] : [];
  }
  const parts: SplitPart[] = [];
  // OCR sometimes loses the first heading; a long preamble usually *is* the
  // first question. Keep it, labelled so the editor checks it.
  const pre = src.slice(0, marks[0].index).trim();
  if (pre.length > 150) {
    parts.push({ label: "بداية الورقة (تحقّق: هل هي السؤال الأول؟)", body: pre, qtype: guessType(pre), compulsory: /إجبار|اجبار/.test(pre) });
  }
  return parts.concat(marks.map((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
    const chunk = src.slice(m.index, end);
    const body = chunk.slice(chunk.indexOf("\n") + 1).trim() || chunk.trim();
    return { label: m.label, body, qtype: guessType(chunk), compulsory: /إجبار|اجبار/.test(chunk) };
  }));
}

function guessType(t: string): QType {
  if (/ضع علامة|اختر الإجابة|اختر الاجابة|\(\s*[صخ√×]\s*\)/.test(t)) return "mcq";
  if (/ترجم|المصطلحات/.test(t)) return "terms";
  if (/الأخطاء|الاخطاء|استخرج/.test(t)) return "errors";
  if (/تركة|التركة|الورثة|أنصبة|انصبة|الفروض/.test(t)) return "calculation";
  if (/^\s*\(?[0-9٠-٩]\)?\s*(قام|اتهم|تقدم|رفع)|\bقام\b|اتهم|أدين|ادين|فما الحكم|ناقش.*الوقائع/.test(t)) return "practical";
  return "essay";
}
