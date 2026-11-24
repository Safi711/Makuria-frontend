// Split the OCR text of a paper into questions on «السؤال الأول/الثاني…»
// headings. OCR garbles these words often (الرايع، الثالت، الخاومس), so the
// match is loose; anything before the first heading (the paper's header and
// instructions) is dropped from the questions and stays in the OCR text.
// The result is a starting point the editor corrects, never final text.

import type { QType } from "./labels";

// A heading line: up to ~14 characters of OCR noise («ظ», «0», «|»…), then a
// garbled form of «السؤال» (السوال، السعؤال، لسؤال، السوّال…), then an ordinal-like word.
const HEADING = /^[^\n\u0621-\u064a]{0,6}(?:[\u0621-\u064a]{1,2}\s)?[^\n\u0621-\u064a]{0,6}ا?ل?\s?س[ؤوعّ]{1,3}ا?ل\s*ال[\u0621-\u064a]{3,7}[^\n]{0,40}/gm;

export type SplitPart = { label: string; body: string; qtype: QType; compulsory: boolean };

export function splitQuestions(text: string): SplitPart[] {
  const src = (text || "").replace(/\r/g, "");
  const marks: { index: number; label: string }[] = [];
  for (const m of src.matchAll(HEADING)) {
    const raw = m[0].replace(/[\u200e\u200f]/g, "");
    const n = ordinal(raw);
    const label = n ? `السؤال ${ORDINALS[n - 1]}` : raw.trim().slice(0, 40);
    marks.push({ index: m.index ?? 0, label: label.slice(0, 60) });
  }
  if (marks.length === 0) {
    const body = src.trim();
    return body ? [{ label: "السؤال", body, qtype: guessType(body), compulsory: false }] : [];
  }
  const parts: SplitPart[] = [];
  // OCR sometimes loses the first heading; a long preamble usually *is* the
  // first question. Keep it, labelled so the editor checks it.
  // Ignore the paper's header block (bismillah, title, session, subject,
  // date, instructions): count only what follows it.
  const pre = src.slice(0, marks[0].index).trim();
  const preBody = pre.split("\n").filter((l) => !/الرحمن|امتحان|امت|تنظيم|دورة|دور|مادة|ماد|التاريخ|الزمن|أجب|اجب|أيسعن/.test(l)).join("\n").replace(/[^\u0621-\u064a\s]/g, "").trim();
  if (preBody.length > 150) {
    parts.push({ label: "بداية الورقة (تحقّق: هل هي السؤال الأول؟)", body: pre, qtype: guessType(pre), compulsory: /إجبار|اجبار/.test(pre) });
  }
  return parts.concat(marks.map((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
    const chunk = src.slice(m.index, end);
    const body = chunk.slice(chunk.indexOf("\n") + 1).trim() || chunk.trim();
    return { label: m.label, body, qtype: guessType(chunk), compulsory: /إجبار|اجبار/.test(chunk) };
  }));
}

const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

/** Read the ordinal from a garbled heading («السؤال الرايع» → 4). */
function ordinal(heading: string): number | null {
  const w = heading.match(/س[ؤوعّ]{1,3}ا?ل\s*(ال[\u0621-\u064a]{2,7})/)?.[1] ?? "";
  const tests: [RegExp, number][] = [
    [/^ال[أاإ]و/, 1],
    [/^ال[تث]ا?ل[تثك]/, 3],
    [/^ال[تث]ام/, 8],
    [/^ال[تث]اس/, 9],
    [/^ال[تث]ان/, 2],
    [/^ال[رو]ا[بي]/, 4],
    [/^الخا/, 5],
    [/^ال[سح]ت?اد/, 6],
    [/^ال[سش]ا[بيم]/, 7],
    [/^العاش/, 10],
  ];
  for (const [re, n] of tests) if (re.test(w)) return n;
  return null;
}

function guessType(t: string): QType {
  if (/ضع علامة|اختر الإجابة|اختر الاجابة|\(\s*[صخ√×]\s*\)/.test(t)) return "mcq";
  if (/ترجم|المصطلحات/.test(t)) return "terms";
  if (/الأخطاء|الاخطاء|استخرج/.test(t)) return "errors";
  if (/تركة|التركة|الورثة|أنصبة|انصبة|الفروض/.test(t)) return "calculation";
  if (/^\s*\(?[0-9٠-٩]\)?\s*(قام|اتهم|تقدم|رفع)|\bقام\b|اتهم|أدين|ادين|فما الحكم|ناقش.*الوقائع/.test(t)) return "practical";
  return "essay";
}
