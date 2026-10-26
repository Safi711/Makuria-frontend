/**
 * Unit tests for the clarifying-questions layer (Commit 54).
 * Pure: no database, no LLM, no credentials.
 * Run: npx tsx lib/case-mapper/__tests__/test-clarification.ts
 */
import {
  buildClarification,
  detectPublicLawDomain,
  isAmbiguousGrievance,
  isTruncatedShort,
  questionSetForCard,
  QUESTION_SETS,
  type ClarificationInputResult,
} from "../clarification";

let passed = 0;
let failed = 0;
function test(label: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (e: any) { console.log(`  ✗ ${label}\n    ${e.message}`); failed++; }
}
function eq(a: unknown, b: unknown, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

const EMPTY: ClarificationInputResult = { laws: [], noConfidentMatch: true, hasAnyResults: false };
const CIVIL: ClarificationInputResult = {
  laws: [{ lawSlug: "civil-transactions-1984" }], noConfidentMatch: false, hasAnyResults: true,
};
const CRIMINAL: ClarificationInputResult = {
  laws: [{ lawSlug: "criminal-law-1991" }], noConfidentMatch: false, hasAnyResults: true,
};
const reason = (facts: string, r: ClarificationInputResult) => buildClarification(facts, r)?.reason ?? null;

console.log("\ntest-clarification — golden cases");
// T21–T23: classify_and_clarify (engine returns no criminal article)
test("T21 civil-service dismissal → administrative",
  () => eq(reason("أنا موظف بالخدمة المدنية، وصدر قرار بفصلي من جهة حكومية، وأريد الطعن عليه لعدم اتباع إجراءات الفصل المطلوبة.", EMPTY), "administrative"));
test("T22 licence refusal → administrative",
  () => eq(reason("رفضت جهة إدارية تجديد ترخيص نشاطي، وأريد معرفة طريق الطعن في قرارها وأساس الرفض.", EMPTY), "administrative"));
test("T23 discriminatory statute → constitutional",
  () => eq(reason("أريد الطعن في نص تشريعي لأنه يميز بين مواطنين في حق واحد بسبب أصلهم، وأحتاج معرفة المسار الدستوري المتاح.", EMPTY), "constitutional"));
test("T21 also passes when the engine returned civil articles",
  () => eq(reason("أنا موظف بالخدمة المدنية، وصدر قرار بفصلي من جهة حكومية.", CIVIL), "administrative"));
// T26–T28: no_reliable_match_and_clarify
test("T26 «عندي مشكلة مع شخص.» → ambiguous", () => eq(reason("عندي مشكلة مع شخص.", EMPTY), "ambiguous"));
test("T27 «حقي ضاع.» → ambiguous", () => eq(reason("حقي ضاع.", EMPTY), "ambiguous"));
test("T28 «واحد سر…» → truncated", () => eq(reason("واحد سر…", EMPTY), "truncated"));
test("T28 with three dots → truncated", () => eq(reason("واحد سر...", EMPTY), "truncated"));
test("T28 asks to complete, never names an offence", () => {
  const q = buildClarification("واحد سر…", EMPTY)!.groups.flatMap((g) => g.questions).join(" ");
  if (/سرق/.test(q)) throw new Error(`question completes the word: ${q}`);
});

console.log("\nno questions where none belong");
test("T24 «اشتريت قميصًا.» → none", () => eq(reason("اشتريت قميصًا.", EMPTY), null));
test("T25 weather sentence → none", () => eq(reason("الجو جميل اليوم وأريد الذهاب إلى النيل.", EMPTY), null));
test("plain theft with results → none",
  () => eq(reason("دخل شخص منزل جاره أثناء غيابه دون إذن، وأخذ هاتفاً محمولاً ومبلغاً من المال.", CRIMINAL), null));
test("«سرق حقيبتي» is not a grievance-only text (حقي ≠ حقيبتي)", () => eq(isAmbiguousGrievance("سرق حقيبتي"), false));
test("short grievance that DID match an offence → none",
  () => eq(reason("ظلمني جاري وضربني", CRIMINAL), null));
test("long account ending in … is not truncated",
  () => eq(isTruncatedShort("دخل المتهم المتجر وهدد العامل بسكين وأخذ النقود ثم هرب…"), false));
test("«تقويض النظام الدستوري» with a criminal article → not constitutional",
  () => eq(reason("قام المتهمون بتقويض النظام الدستوري بالقوة", CRIMINAL), null));
test("«قرار» alone without an administrative marker → none", () => eq(detectPublicLawDomain("اتخذت قراراً بالسفر"), null));
test("criminal dismissal wording with criminal article → not administrative",
  () => eq(reason("فصل المتهم رأس المجني عليه عن جسده بقرار منه", CRIMINAL), null));

console.log("\nexamination cards");
test("injury cards share one question set", () => {
  eq(questionSetForCard("إصابة:وصف"), "injury");
  eq(questionSetForCard("جرح:وصف"), "injury");
  eq(questionSetForCard("إصابة:مراجعة"), "injury");
});
test("every شروع:* card asks the homicide-intent questions", () => {
  eq(questionSetForCard("شروع:سلاح"), "homicideIntent");
  eq(questionSetForCard("شروع:سم"), "homicideIntent");
  eq(questionSetForCard("شروع:حرق"), "homicideIntent");
});
test("cards without approved questions ask nothing", () => {
  for (const c of ["فاحشة:مراجعة", "حرابة:فحص", "نهب:جرح", "قرار:مشروعية", "مخدرات:تقديم"]) {
    eq(questionSetForCard(c), null, c);
  }
});
test("criminal result with cards → open_points, deduplicated, card label as heading", () => {
  const c = buildClarification("ضرب المتهم المجني عليه بعصا", {
    ...CRIMINAL,
    discuss: [
      { concept: "جرح:وصف", label: "وصف الإصابة: جراح أم أذى — نقطة مفتوحة للمحامي" },
      { concept: "إصابة:وصف", label: "تكرار" },
      { concept: "قتل:وصف", label: "وصف القتل: عمد أم شبه عمد — نقطة مفتوحة للمحامي" },
      { concept: "نهب:جرح", label: "بلا أسئلة" },
    ],
  })!;
  eq(c.reason, "open_points");
  eq(c.groups.map((g) => g.key), ["injury", "homicideIntent"]);
  eq(c.groups[0].titleAr, "وصف الإصابة: جراح أم أذى — نقطة مفتوحة للمحامي");
  eq(c.groups[0].questions, QUESTION_SETS.injury.questions);
});
test("administrative result keeps its card groups after the domain group", () => {
  const c = buildClarification("رفضت جهة إدارية تجديد ترخيص نشاطي", {
    ...EMPTY, discuss: [{ concept: "قرار:مشروعية", label: "مراجعة مشروعية القرار" }],
  })!;
  eq(c.reason, "administrative");
  eq(c.groups.map((g) => g.key), ["administrative"]);
});
test("questions come only from the fixed bank", () => {
  const all = new Set(Object.values(QUESTION_SETS).flatMap((s) => s.questions));
  for (const f of ["حقي ضاع.", "واحد سر…", "رفضت جهة إدارية تجديد ترخيص نشاطي"]) {
    for (const q of buildClarification(f, EMPTY)!.groups.flatMap((g) => g.questions)) {
      if (!all.has(q)) throw new Error(`question not in bank: ${q}`);
    }
  }
});
test("builder does not mutate the bank", () => {
  const before = JSON.stringify(QUESTION_SETS);
  const c = buildClarification("حقي ضاع.", EMPTY)!;
  c.groups[0].questions.push("x");
  eq(JSON.stringify(QUESTION_SETS), before);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
