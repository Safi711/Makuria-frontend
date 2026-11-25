"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/equivalency/editor";
import {
  COMPLETENESS,
  PAPER_STATUS,
  QTYPE,
  REVIEW_STATUS,
  SESSION_MONTHS,
  SOLUTION_KIND,
  isOneOf,
} from "@/lib/equivalency/labels";
import { splitQuestions } from "@/lib/equivalency/split";

// Every action re-checks the caller (requireEditor) and the database checks
// again through RLS (is_eq_editor). Inputs are FormData from the browser and
// are treated as untrusted: ids are validated, enums are whitelisted, and
// nothing about ownership or status is taken from the client unchecked.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(fd: FormData, k: string, max = 20000): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}
function id(fd: FormData, k: string): string {
  const v = fd.get(k);
  if (typeof v !== "string" || !UUID.test(v)) throw new Error("معرّف غير صالح");
  return v;
}
function year(fd: FormData): number | null {
  const v = Number(str(fd, "exam_year", 4));
  return Number.isInteger(v) && v >= 1990 && v <= 2100 ? v : null;
}
function month(fd: FormData): string | null {
  const v = str(fd, "session_month", 20);
  return v && (SESSION_MONTHS as readonly string[]).includes(v) ? v : null;
}

const PAPER_PATHS = (paperId: string) => `/admin/equivalency/papers/${paperId}`;

/**
 * Production builds hide thrown messages from the browser, so a refusal such
 * as «لا تُنشر ورقة بلا أسئلة» would show as a generic error page. Instead the
 * editor is sent back to the page they were on with the message in ?err=,
 * which the page prints. Redirects thrown on success pass through.
 */
async function run(fd: FormData, fn: (fd: FormData) => Promise<void>) {
  const pid = fd.get("paper_id");
  try {
    await fn(fd);
  } catch (e) {
    unstable_rethrow(e);
    const back = typeof pid === "string" && UUID.test(pid) ? PAPER_PATHS(pid) : "/admin/equivalency/new";
    const msg = e instanceof Error ? e.message : "تعذّر تنفيذ الطلب";
    redirect(`${back}?err=${encodeURIComponent(msg.slice(0, 300))}`);
  }
  // Success: land on the clean URL so an earlier ?err= doesn't linger.
  if (typeof pid === "string" && UUID.test(pid)) redirect(PAPER_PATHS(pid));
}

function revalidatePublic() {
  revalidatePath("/equivalency", "layout");
}

// ---------------------------------------------------------------------------
// Papers

async function _createPaper(fd: FormData) {
  const { supabase } = await requireEditor();
  const subjectId = id(fd, "subject_id");
  const originals = fd
    .getAll("original_paths")
    .filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}\/[\w.-]{1,120}$/i.test(v));

  const { data, error } = await supabase
    .from("eq_papers")
    .insert({
      subject_id: subjectId,
      exam_year: year(fd),
      session_month: month(fd),
      title_ar: str(fd, "title_ar", 200),
      source_note: str(fd, "source_note", 500),
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "تعذّر الحفظ");

  const { error: e2 } = await supabase.from("eq_paper_internal").insert({
    paper_id: data.id,
    ocr_text: str(fd, "ocr_text", 200000),
    original_paths: originals,
  });
  if (e2) throw new Error(e2.message);

  if (fd.get("split") === "on") await doSplit(supabase, data.id);
  redirect(PAPER_PATHS(data.id));
}

async function _updatePaper(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const completeness = str(fd, "completeness", 20);
  const { error } = await supabase
    .from("eq_papers")
    .update({
      subject_id: id(fd, "subject_id"),
      exam_year: year(fd),
      session_month: month(fd),
      title_ar: str(fd, "title_ar", 200),
      source_note: str(fd, "source_note", 500),
      completeness: isOneOf(completeness, Object.keys(COMPLETENESS)) ? completeness : "unknown",
      completeness_note: str(fd, "completeness_note", 500),
      needs_review: fd.get("needs_review") === "on",
    })
    .eq("id", paperId);
  if (error) throw new Error(error.message);

  const { error: e2 } = await supabase
    .from("eq_paper_internal")
    .upsert({ paper_id: paperId, ocr_text: str(fd, "ocr_text", 200000), review_note: str(fd, "review_note", 2000) });
  if (e2) throw new Error(e2.message);

  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

/** Publishing a paper never publishes its solutions; they have their own status. */
async function _setPaperStatus(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const status = str(fd, "status", 20);
  if (!isOneOf(status, Object.keys(PAPER_STATUS))) throw new Error("حالة غير صالحة");

  if (status === "published") {
    const { count } = await supabase
      .from("eq_questions")
      .select("id", { count: "exact", head: true })
      .eq("paper_id", paperId);
    if (!count) throw new Error("لا تُنشر ورقة بلا أسئلة. قسّم النص إلى أسئلة أولاً.");
  }

  const { error } = await supabase
    .from("eq_papers")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      ...(status === "published" ? { needs_review: false } : {}),
    })
    .eq("id", paperId);
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

async function _deletePaper(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  if (fd.get("confirm") !== "حذف") throw new Error("اكتب «حذف» للتأكيد");
  const { data: paper } = await supabase.from("eq_papers").select("status").eq("id", paperId).maybeSingle();
  if (paper?.status === "published") throw new Error("ألغِ نشر الورقة قبل حذفها");
  const { error } = await supabase.from("eq_papers").delete().eq("id", paperId);
  if (error) throw new Error(error.message);
  revalidatePublic();
  redirect("/admin/equivalency");
}

// ---------------------------------------------------------------------------
// Questions

type Supa = Awaited<ReturnType<typeof requireEditor>>["supabase"];

async function doSplit(supabase: Supa, paperId: string) {
  const { data: internal } = await supabase
    .from("eq_paper_internal")
    .select("ocr_text")
    .eq("paper_id", paperId)
    .maybeSingle();
  const parts = splitQuestions(internal?.ocr_text ?? "");
  if (parts.length === 0) throw new Error("لا يوجد نص لتقسيمه");

  const { count } = await supabase
    .from("eq_questions")
    .select("id", { count: "exact", head: true })
    .eq("paper_id", paperId);
  if (count) throw new Error("للورقة أسئلة بالفعل. احذفها أولاً إن أردت إعادة التقسيم.");

  const { error } = await supabase.from("eq_questions").insert(
    parts.map((p, i) => ({
      paper_id: paperId,
      position: i + 1,
      label_ar: p.label,
      body_ar: p.body,
      qtype: p.qtype,
      is_compulsory: p.compulsory,
    })),
  );
  if (error) throw new Error(error.message);
}

async function _splitPaper(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  await doSplit(supabase, paperId);
  revalidatePath(PAPER_PATHS(paperId));
}

async function _addQuestion(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const { data: last } = await supabase
    .from("eq_questions")
    .select("position")
    .eq("paper_id", paperId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("eq_questions").insert({
    paper_id: paperId,
    position: (last?.position ?? 0) + 1,
    label_ar: str(fd, "label_ar", 100),
    body_ar: str(fd, "body_ar") ?? "—",
  });
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
}

async function _updateQuestion(fd: FormData) {
  const { supabase } = await requireEditor();
  const qId = id(fd, "question_id");
  const paperId = id(fd, "paper_id");
  const qtype = str(fd, "qtype", 20);
  const topic = str(fd, "topic_id", 40);
  const marks = Number(str(fd, "marks", 6));
  const body = str(fd, "body_ar");
  if (!body) throw new Error("نص السؤال مطلوب");
  const { error } = await supabase
    .from("eq_questions")
    .update({
      label_ar: str(fd, "label_ar", 100),
      body_ar: body,
      qtype: isOneOf(qtype, Object.keys(QTYPE)) ? qtype : "essay",
      is_compulsory: fd.get("is_compulsory") === "on",
      marks: Number.isFinite(marks) && marks > 0 ? marks : null,
      topic_id: topic && UUID.test(topic) ? topic : null,
      text_verified: fd.get("text_verified") === "on",
    })
    .eq("id", qId)
    .eq("paper_id", paperId);
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

async function _deleteQuestion(fd: FormData) {
  const { supabase } = await requireEditor();
  const qId = id(fd, "question_id");
  const paperId = id(fd, "paper_id");
  const { error } = await supabase.from("eq_questions").delete().eq("id", qId).eq("paper_id", paperId);
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

// ---------------------------------------------------------------------------
// Solutions

async function _saveSolution(fd: FormData) {
  const { supabase, user } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const questionId = id(fd, "question_id");
  const solutionId = str(fd, "solution_id", 40);
  const kind = str(fd, "kind", 20);
  const status = str(fd, "review_status", 20);
  if (!isOneOf(kind, Object.keys(SOLUTION_KIND))) throw new Error("نوع حل غير صالح");
  if (!isOneOf(status, Object.keys(REVIEW_STATUS))) throw new Error("حالة غير صالحة");

  const row = {
    question_id: questionId,
    kind,
    review_status: status,
    issue_ar: str(fd, "issue_ar"),
    rules_ar: str(fd, "rules_ar"),
    application_ar: str(fd, "application_ar"),
    conclusion_ar: str(fd, "conclusion_ar"),
    author_name: str(fd, "author_name", 200),
    external_source: str(fd, "external_source", 500),
    permission_note: str(fd, "permission_note", 500),
    ...(status === "published" ? { reviewed_by: user.id, reviewed_at: new Date().toISOString() } : {}),
  };
  if (kind === "external" && status === "published" && (!row.external_source || !row.permission_note)) {
    throw new Error("الحل الخارجي لا يُنشر إلا بذكر مصدره وإذن صاحبه");
  }
  if (status === "published" && !row.conclusion_ar && !row.rules_ar) {
    throw new Error("لا يُنشر حل فارغ");
  }

  const q =
    solutionId && UUID.test(solutionId)
      ? supabase.from("eq_solutions").update(row).eq("id", solutionId).eq("question_id", questionId)
      : supabase.from("eq_solutions").insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

async function _deleteSolution(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const { error } = await supabase.from("eq_solutions").delete().eq("id", id(fd, "solution_id"));
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

/**
 * Link a citation to an article in Makuria's library by law slug + article
 * number. If no such article exists the citation is still saved as a label
 * (article_id null) and the editor sees that it isn't linked.
 */
async function _addCitation(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const solutionId = id(fd, "solution_id");
  const lawSlug = str(fd, "law_slug", 120);
  const number = str(fd, "article_number", 20);
  const label = str(fd, "article_label", 100) ?? (number ? `م${number}` : null);
  if (!label) throw new Error("اذكر رقم المادة");

  let articleId: string | null = null;
  if (lawSlug && number) {
    const { data: law } = await supabase.from("laws").select("id").eq("slug", lawSlug).maybeSingle();
    if (law) {
      const { data: art } = await supabase
        .from("articles")
        .select("id")
        .eq("law_id", law.id)
        .eq("article_number", number)
        .limit(1)
        .maybeSingle();
      articleId = art?.id ?? null;
    }
  }
  const { count } = await supabase
    .from("eq_citations")
    .select("id", { count: "exact", head: true })
    .eq("solution_id", solutionId);
  const { error } = await supabase.from("eq_citations").insert({
    solution_id: solutionId,
    law_slug: lawSlug,
    article_id: articleId,
    article_label: label,
    note_ar: str(fd, "note_ar", 1000),
    position: count ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

async function _deleteCitation(fd: FormData) {
  const { supabase } = await requireEditor();
  const paperId = id(fd, "paper_id");
  const { error } = await supabase.from("eq_citations").delete().eq("id", id(fd, "citation_id"));
  if (error) throw new Error(error.message);
  revalidatePath(PAPER_PATHS(paperId));
  revalidatePublic();
}

// ---------------------------------------------------------------------------
// Exported actions (each runs through run() for readable errors)
export async function createPaper(fd: FormData) {
  await run(fd, _createPaper);
}
export async function updatePaper(fd: FormData) {
  await run(fd, _updatePaper);
}
export async function setPaperStatus(fd: FormData) {
  await run(fd, _setPaperStatus);
}
export async function deletePaper(fd: FormData) {
  await run(fd, _deletePaper);
}
export async function splitPaper(fd: FormData) {
  await run(fd, _splitPaper);
}
export async function addQuestion(fd: FormData) {
  await run(fd, _addQuestion);
}
export async function updateQuestion(fd: FormData) {
  await run(fd, _updateQuestion);
}
export async function deleteQuestion(fd: FormData) {
  await run(fd, _deleteQuestion);
}
export async function saveSolution(fd: FormData) {
  await run(fd, _saveSolution);
}
export async function deleteSolution(fd: FormData) {
  await run(fd, _deleteSolution);
}
export async function addCitation(fd: FormData) {
  await run(fd, _addCitation);
}
export async function deleteCitation(fd: FormData) {
  await run(fd, _deleteCitation);
}

// ---------------------------------------------------------------------------
// Batch import (one paper per call, so a large file never hits the request
// size limit). Idempotent on import_key: a paper already imported is skipped.

export type ImportItem = {
  import_key: string;
  subject: string;
  session_month: string | null;
  title_ar: string | null;
  source_note: string | null;
  review_note: string | null;
  ocr_text: string | null;
};

export async function importDraft(item: ImportItem): Promise<"created" | "skipped" | string> {
  try {
    const { supabase } = await requireEditor();
    if (!item || typeof item.import_key !== "string" || !/^scan:[\w.:-]{3,120}$/.test(item.import_key)) {
      return "مفتاح استيراد غير صالح";
    }
    const { data: existing } = await supabase
      .from("eq_paper_internal")
      .select("paper_id")
      .eq("import_key", item.import_key)
      .maybeSingle();
    if (existing) return "skipped";

    const { data: subject } = await supabase
      .from("eq_subjects")
      .select("id")
      .eq("slug", String(item.subject ?? ""))
      .maybeSingle();
    if (!subject) return `مادة غير معروفة: ${item.subject}`;

    const cap = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.slice(0, n) : null);
    const month = cap(item.session_month, 20);
    const { data: paper, error } = await supabase
      .from("eq_papers")
      .insert({
        subject_id: subject.id,
        session_month: month && (SESSION_MONTHS as readonly string[]).includes(month) ? month : null,
        title_ar: cap(item.title_ar, 200),
        source_note: cap(item.source_note, 500),
        status: "draft",
        needs_review: true,
      })
      .select("id")
      .single();
    if (error || !paper) return error?.message ?? "تعذّر الحفظ";

    const { error: e2 } = await supabase.from("eq_paper_internal").insert({
      paper_id: paper.id,
      ocr_text: cap(item.ocr_text, 200000),
      review_note: cap(item.review_note, 2000),
      import_key: item.import_key,
    });
    if (e2) {
      await supabase.from("eq_papers").delete().eq("id", paper.id);
      return e2.message;
    }
    return "created";
  } catch (e) {
    return e instanceof Error ? e.message : "تعذّر الاستيراد";
  }
}
