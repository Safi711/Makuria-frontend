// S1-B7-070 (Nov 4): «لم يوضح كيف» → ask how the thing reached the accused.
import { buildClarification, appendClarificationAnswers, factsForAnalysis, QUESTION_SETS } from "../clarification";
import { factsMatchEntrustment } from "../kw-matcher.mjs";
let pass = 0, total = 0;
function ok(name: string, cond: boolean, got?: unknown) {
  total++; if (cond) pass++; console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " → " + JSON.stringify(got)}`);
}
const f070 = "ذكر المشتكي أن المتهم أخذ سيارته ولم يعدها. لم يوضح كيف حصل المتهم على السيارة، أو ما إذا كان قد أخذها دون إذن أو تسلمها بموجب اتفاق، أو ما حدث لها لاحقًا.";
const empty = { laws: [], noConfidentMatch: true, hasAnyResults: false };
const c = buildClarification(f070, empty);
ok("B7-070 تسأل أسئلة الحيازة", c?.reason === "missing_facts" && c.groups[0].key === "acquisition", c);
ok("أربعة أسئلة", c?.groups[0].questions.length === 4);
ok("وقائع كاملة بلا «لم يوضح كيف» لا تسأل", buildClarification("سرق المتهم هاتفي من جيبي في السوق", empty) === null);
ok("نتيجة جنائية موجودة لا تسأل", buildClarification(f070, { laws: [{ lawSlug: "criminal-law-1991" }], noConfidentMatch: false, hasAnyResults: true }) === null);
const q = QUESTION_SETS.acquisition.questions;
const answered = appendClarificationAnswers(f070, [
  { question: q[0], answer: "سلمتها له بنفسي" },
  { question: q[1], answer: "أمانة ليوصل بها أولاده للمدرسة لمدة أسبوع" },
  { question: q[2], answer: "طالبته فرفض إرجاعها" },
]);
const fa = factsForAnalysis(answered);
ok("الإجابة تُسقط جملة «لم يوضح كيف»", !fa.includes("لم يوضح"), fa);
ok("وقائع المستخدم الأخرى باقية", fa.includes("أخذ سيارته ولم يعدها"), fa);
ok("لا تصل صيغة السؤال إلى المحلل", !fa.includes("كيف وصل الشيء"), fa);
ok("بعد الإجابة: بوابة الأمانة تعمل", factsMatchEntrustment(fa) === true, fa);
ok("بدون إجابة عن الحيازة تبقى الجملة", factsForAnalysis(appendClarificationAnswers(f070, [{ question: QUESTION_SETS.injury.questions[0], answer: "لا" }])).includes("لم يوضح"));
console.log(`${pass}/${total}`);
if (pass !== total) process.exit(1);
