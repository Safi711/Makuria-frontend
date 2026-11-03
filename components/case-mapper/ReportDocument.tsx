import "@fontsource/amiri/arabic-400.css";
import "@fontsource/amiri/arabic-700.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import { sourceNameAr } from "@/lib/site";
import type { CaseMapResult, RetrievedAuthority } from "@/lib/case-mapper/analyze";
import { answeredQuestions } from "@/lib/case-mapper/clarification";
import { ReportPrintButton } from "./ReportPrintButton";

/**
 * «تقرير بحث قانوني — أبو رنات» — the printable report (Phase 1, feature 5).
 * Approved by Safi on 3 Nov 2026: Arabic only, this title, five sections.
 *
 * The rule the layout serves: verified legal text (section 2, solid navy
 * frame) can never be mistaken for the automated analysis (section 3, dashed
 * gold frame). Article text is the full `content_ar` read from the database
 * for this report, not the search excerpt.
 */

export type ReportArticle = {
  id: string;
  lawTitle: string;
  articleNumber: string | null;
  titleAr: string | null;
  content: string;
  legalStatus: string | null;
  statusNote: string | null;
  sourceUrl: string | null;
  role: string;
};

const RESEARCH_NOTE = "معروضة للبحث، لا للتصنيف";

function statusLabel(s: string | null): { text: string; ok: boolean } {
  switch (s) {
    case "in_force": return { text: "سارية", ok: true };
    case "repealed": return { text: "ملغاة", ok: false };
    case "amended": return { text: "معدّلة", ok: false };
    case "disputed": return { text: "محل نزاع", ok: false };
    case "not_yet_in_force": return { text: "لم تنفذ بعد", ok: false };
    default: return { text: "لم يُتحقق من نفاذها", ok: false };
  }
}

/** Primary results first, then the card articles; one entry per article. */
export function reportArticleRefs(result: CaseMapResult): Array<{ a: RetrievedAuthority; role: string }> {
  const out: Array<{ a: RetrievedAuthority; role: string }> = [];
  const seen = new Set<string>();
  const semantic = result.issues[0]?.origin === "semantic";
  result.laws
    .filter((a) => a.type === "article")
    .forEach((a, i) => {
      if (seen.has(a.id)) return;
      seen.add(a.id);
      out.push({ a, role: semantic ? "الأقرب بالمعنى" : i === 0 ? "النتيجة الأساسية" : "نتيجة إضافية" });
    });
  for (const d of result.discuss ?? []) {
    for (const a of d.articles) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push({ a, role: "للبحث، لا للتصنيف" });
    }
  }
  return out;
}

export function ReportDocument({
  facts,
  result,
  articles,
  reportId,
  dateAr,
}: {
  facts: string;
  result: CaseMapResult;
  articles: ReportArticle[];
  reportId: string;
  dateAr: string;
}) {
  const answered = answeredQuestions(facts);
  const questions = (result.clarification?.groups ?? [])
    .flatMap((g) => g.questions)
    .filter((q) => !answered.has(q));
  const sources = [...new Map(articles.map((a) => [a.lawTitle, a.sourceUrl])).entries()];
  const criminal = result.laws.some((a) => a.lawSlug === "criminal-law-1991") && result.issues[0]?.origin !== "semantic";

  return (
    <div className="ar-report" dir="rtl" lang="ar">
      <style>{REPORT_CSS}</style>

      <div className="report-no-print ar-toolbar">
        <ReportPrintButton />
        <span>في نافذة الطباعة اختر «حفظ بصيغة PDF». لا يُحفظ التقرير في مكوريا.</span>
      </div>

      <div className="ar-head">
        <img src="/abu-rannat/seal-navy.png" alt="" width={64} height={64} />
        <div>
          <h1>تقرير بحث قانوني — أبو رنات</h1>
          <div className="ar-sub">مكوريا — المستشار القانوني الذكي · makuria.legal</div>
        </div>
      </div>
      <div className="ar-meta">
        <div>رقم التقرير: <b>{reportId}</b></div>
        <div>تاريخ التحليل: <b>{dateAr}</b></div>
        <div>تاريخ التحقق من النصوص: <b>{dateAr}</b></div>
        <div>نوع المسألة: <b>{criminal ? "جنائية" : "غير جنائية"}</b></div>
        <div>عدد المواد: <b>{articles.length}</b></div>
        <div>نسخة النص: <b>قاعدة مكوريا</b></div>
      </div>

      <h2><span className="n">1</span>الوقائع كما أدخلها المستخدم</h2>
      <div className="ar-facts">
        {facts}
        <div className="note">نُقلت الوقائع كما كُتبت. تُحذف الأسماء وأرقام الهواتف والهويات قبل أي معالجة آلية.</div>
      </div>

      <h2><span className="n">2</span>المرجعية الموثقة</h2>
      <div className="ar-verified">
        <span className="tag">نصوص من قاعدة مكوريا، منقولة حرفياً كما هي مسجّلة</span>
        {articles.length === 0 && <p>لم يُعثر على مادة مطابقة بثقة كافية.</p>}
        {articles.map((a) => {
          const st = statusLabel(a.legalStatus);
          const note = a.statusNote && a.statusNote !== RESEARCH_NOTE ? a.statusNote : null;
          return (
            <div className="art" key={a.id}>
              <h3>
                {a.lawTitle} — المادة {a.articleNumber ?? "؟"}{a.titleAr ? `: ${a.titleAr}` : ""}
                <span className={`pill ${st.ok ? "ok" : "warn"}`}>{st.text}</span>
                <span className="pill role">{a.role}</span>
              </h3>
              <div className="text">{a.content}</div>
              {note && <div className="snote">{note}</div>}
              <div className="src">المصدر: {sourceNameAr(a.sourceUrl) ?? "قيد التوثيق"}</div>
            </div>
          );
        })}
      </div>

      <h2><span className="n">3</span>التحليل</h2>
      <div className="ar-analysis">
        <span className="tag">تحليل آلي من أبو رنات — ليس رأياً قانونياً ولا جزءاً من النص</span>
        <h3>لماذا ظهرت هذه المواد</h3>
        {result.issues.length === 0 && <p>لم تُحدَّد مسألة قانونية بثقة كافية.</p>}
        {result.issues.map((iss, i) => (
          <p key={i}>
            {iss.origin === "semantic"
              ? "بُحث بالمعنى عن المسألة القانونية في الوقائع، لا بمطابقة الكلمات، ورُتّبت المواد بحسب قربها منها."
              : `المصطلح القانوني المقابل للوقائع: «${iss.term}».`}
          </p>
        ))}
        {(result.discuss ?? []).map((d) => (
          <div key={d.concept}>
            <h3>نقطة مفتوحة للمحامي: {d.label}</h3>
            {d.description && <p>{d.description}</p>}
            {d.evidenceLine && <p><b>قرائن تُفحص:</b> {d.evidenceLine}</p>}
            {d.cautionLine && <p>{d.cautionLine}</p>}
            {d.negationNote && <p>{d.negationNote}</p>}
            {d.conflictLine && <p>{d.conflictLine}</p>}
          </div>
        ))}
      </div>

      {questions.length > 0 && (
        <>
          <h2><span className="n">4</span>ما يحتاجه المحامي لاستكمال الملف</h2>
          <ul className="ar-qs">{questions.map((q) => <li key={q}>{q}</li>)}</ul>
        </>
      )}

      <h2><span className="n">{questions.length > 0 ? 5 : 4}</span>المصادر</h2>
      <table className="ar-src">
        <thead><tr><th>القانون</th><th>المصدر</th><th>الرابط</th></tr></thead>
        <tbody>
          {sources.map(([law, url]) => (
            <tr key={law}>
              <td>{law}</td>
              <td>{sourceNameAr(url) ?? "قيد التوثيق"}</td>
              <td className="ltr">{url?.startsWith("http") ? url.replace(/^https?:\/\//, "") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ar-foot">
        <img src="/abu-rannat/badge.png" alt="" width={76} height={76} />
        <div>
          <p><b>اكتمل التحليل وفُحصت الإحالات</b></p>
          <p>كل مادة في القسم 2 منقولة من قاعدة مكوريا في تاريخ التحقق، ومعها مصدرها وحالة نفاذها كما هي مسجّلة. القسم 3 تحليل آلي يساعد في البحث، وليس اعتماداً قانونياً للدعوى. التكييف والإثبات مهمة المحامي، والفصل للمحكمة.</p>
          <p>سُمّي أبو رنات تكريماً للقاضي محمد أحمد أبو رنات، أول رئيس قضاء سوداني، ولا تُنسب إليه الإجابات.</p>
        </div>
      </div>
    </div>
  );
}

const REPORT_CSS = `
.ar-report{--navy:#0b1930;--gold:#b8952b;--gold-l:#f6eed4;--ink:#1b2333;--muted:#5d6878;--line:#d9dee6;
  font-family:Amiri,serif;color:var(--ink);background:#fff;font-size:12pt;line-height:1.65;
  max-width:820px;margin:24px auto;padding:28px 32px;border-radius:8px}
.ar-report *{box-sizing:border-box}
.ar-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:18px;font-size:10.5pt;color:var(--muted)}
.ar-head{display:flex;align-items:center;gap:14px;border-bottom:3px solid var(--navy);padding-bottom:10px}
.ar-head h1{margin:0;font-size:21pt;color:var(--navy);line-height:1.25;font-weight:700}
.ar-sub{color:var(--muted);font-size:10.5pt}
.ar-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;margin:10px 0 4px;font-size:10.5pt;color:var(--muted)}
.ar-meta b{color:var(--ink)}
.ar-report h2{font-size:14pt;color:var(--navy);margin:16px 0 6px;display:flex;align-items:center;gap:8px;font-weight:700}
.ar-report h2 .n{display:inline-flex;width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;font-size:11pt;align-items:center;justify-content:center}
.ar-facts{border:1px solid var(--line);border-radius:6px;padding:10px 14px;background:#fafbfc;white-space:pre-line}
.ar-facts .note{font-size:9.5pt;color:var(--muted);margin-top:6px;white-space:normal}
.ar-verified{border:2px solid var(--navy);border-radius:8px;padding:2px 14px 10px}
.ar-verified .tag,.ar-analysis .tag{display:inline-block;font-size:9.5pt;padding:1px 10px;border-radius:10px;margin-top:10px}
.ar-verified .tag{background:var(--navy);color:#fff}
.ar-report .art{border-top:1px solid var(--line);padding-top:8px;margin-top:10px;break-inside:avoid}
.ar-report .art h3{margin:0;font-size:12.5pt;color:var(--navy);font-weight:700}
.ar-report .art .text{white-space:pre-line;margin:4px 0}
.ar-report .snote{font-size:9.5pt;color:#6b5414;background:var(--gold-l);border-radius:4px;padding:2px 8px;margin:4px 0}
.ar-report .src{font-size:9.5pt;color:var(--muted)}
.ar-report .pill{font-size:9pt;border-radius:9px;padding:0 8px;margin-inline-start:6px;font-weight:400}
.ar-report .pill.ok{background:#e7f3ea;color:#1f7a3d}
.ar-report .pill.warn{background:#fdf2e0;color:#92600b}
.ar-report .pill.role{background:var(--gold-l);color:#6b5414}
.ar-analysis{border:2px dashed var(--gold);border-radius:8px;padding:2px 14px 10px;background:#fffdf6}
.ar-analysis .tag{background:var(--gold-l);color:#6b5414;border:1px solid var(--gold)}
.ar-analysis h3{font-size:12pt;margin:10px 0 2px;color:#6b5414;font-weight:700}
.ar-analysis p{margin:2px 0}
.ar-qs li{margin:2px 0}
.ar-src{width:100%;border-collapse:collapse;font-size:10pt}
.ar-src td,.ar-src th{border-bottom:1px solid var(--line);padding:4px 6px;text-align:right;vertical-align:top}
.ar-src th{color:var(--muted);font-weight:400}
.ar-report .ltr{direction:ltr;unicode-bidi:embed;font-size:9pt}
.ar-foot{margin-top:14px;display:flex;align-items:center;gap:14px;border-top:3px solid var(--navy);padding-top:10px;break-inside:avoid}
.ar-foot p{margin:0;font-size:10pt;color:var(--muted)}
.ar-foot b{color:var(--navy)}
@page{size:A4;margin:16mm 16mm 18mm}
@media print{
  body > a, body header, body footer, .report-no-print{display:none !important}
  body{background:#fff !important}
  .ar-report{margin:0;padding:0;max-width:none;border-radius:0}
}
`;
