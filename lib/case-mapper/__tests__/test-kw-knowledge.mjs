// Commit 42, Change A — factsMatchLabPending, factsMatchKnowledgeDisputed, factsMatchConsentDisputed
// Run with: node lib/case-mapper/__tests__/test-kw-knowledge.mjs
import {
  factsMatchLabPending,
  factsMatchKnowledgeDisputed,
  factsMatchConsentDisputed,
} from "../kw-matcher.mjs";

let allPassed = true;
let total = 0, passed = 0;
function check(label, got, expected) {
  total++;
  const ok = got === expected;
  if (!ok) allPassed = false;
  else passed++;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) console.log(`    expected: ${JSON.stringify(expected)}  got: ${JSON.stringify(got)}`);
}

// ── factsMatchLabPending ────────────────────────────────────────────────────
console.log("\nfactsMatchLabPending\n" + "─".repeat(70));

check("اشتبه — basic suspect keyword",
  factsMatchLabPending("اشتبه المحقق في المادة المضبوطة."),
  true);

check("قيد الفحص — under examination",
  factsMatchLabPending("المادة قيد الفحص في المعمل الجنائي."),
  true);

check("قيد التحليل — under analysis",
  factsMatchLabPending("العينة لا تزال قيد التحليل."),
  true);

check("لم تصدر النتيجة — result not yet issued",
  factsMatchLabPending("لم تصدر النتيجة حتى تاريخ الجلسة."),
  true);

check("أرسلت إلى المعمل — sent to lab",
  factsMatchLabPending("أرسلت المضبوطات إلى المعمل الجنائي."),
  true);

check("بانتظار نتيجة — awaiting result",
  factsMatchLabPending("الملف بانتظار نتيجة المعمل."),
  true);

check("مشتبه — adjective form",
  factsMatchLabPending("وجدوا مادة مشتبهاً بها."),
  true);

check("أُرسلت للمعمل — alternate sent form (contiguous)",
  factsMatchLabPending("أُرسلت للمعمل الجنائي لتحليلها."),
  true);

// guard: أثبت + المعمل within 3 tokens → false
check("أثبت المعمل guard — confirmed by lab → false",
  factsMatchLabPending("أثبت المعمل أن المادة مخدر."),
  false);

check("أكد التقرير guard — report confirmed → false",
  factsMatchLabPending("أكد التقرير وجود الهيروين."),
  false);

check("no lab keywords → false",
  factsMatchLabPending("ضبط المتهم بحوزته أموالاً مسروقة."),
  false);

// ── factsMatchKnowledgeDisputed ─────────────────────────────────────────────
console.log("\nfactsMatchKnowledgeDisputed\n" + "─".repeat(70));

check("أنكر علمه — explicit denial → disputed",
  factsMatchKnowledgeDisputed("ضبط المتهم وبحوزته حقيبة وأنكر علمه بمحتوياتها."),
  "disputed");

check("لا يعرف — doesn't know → disputed",
  factsMatchKnowledgeDisputed("عثر عليه المال المسروق وقال إنه لا يعرف مصدره."),
  "disputed");

check("لم يكن يعلم — did not know → disputed",
  factsMatchKnowledgeDisputed("وجد معه الطرد ولم يكن يعلم بما فيه."),
  "disputed");

check("لم يفتحها — did not open it → disputed",
  factsMatchKnowledgeDisputed("استلم المتهم الكرتونة ولم يفتحها."),
  "disputed");

check("تخص شخصاً آخر — belongs to another → disputed",
  factsMatchKnowledgeDisputed("ضبطت بحوزته وقال إنها تخص شخصاً آخر."),
  "disputed");

check("اعترف — admitted → admitted",
  factsMatchKnowledgeDisputed("اعترف المتهم بأنه اشترى المواد."),
  "admitted");

check("أقر بعلمه — admitted knowledge → admitted",
  factsMatchKnowledgeDisputed("أقر بعلمه بأن البضاعة مسروقة."),
  "admitted");

check("يعلم أنها مسروقة — knows it was stolen → admitted",
  factsMatchKnowledgeDisputed("كان يعلم أنها مسروقة وأخفاها في منزله."),
  "admitted");

check("no knowledge keywords → null",
  factsMatchKnowledgeDisputed("دخل المتهم المتجر وأخذ بضاعة بدون إذن."),
  null);

// ── factsMatchConsentDisputed ───────────────────────────────────────────────
console.log("\nfactsMatchConsentDisputed\n" + "─".repeat(70));

check("واقعها — intercourse, no contest → refused",
  factsMatchConsentDisputed("واقعها المتهم بالقوة."),
  "refused");

check("اغتصب — rape → refused",
  factsMatchConsentDisputed("اغتصب المتهم الضحية في المنزل المهجور."),
  "refused");

check("تحرش — harassment → refused",
  factsMatchConsentDisputed("تحرش المتهم بالمجني عليها في المصعد."),
  "refused");

check("واقعها + برضاها → contested",
  factsMatchConsentDisputed("واقعها المتهم وادعى أن الأمر كان برضاها."),
  "contested");

check("علاقة جنسية + قال إنها وافقت → contested",
  factsMatchConsentDisputed("مارس الجنس معها وقال إنها وافقت."),
  "contested");

check("اغتصب + ادعى الرضا → contested",
  factsMatchConsentDisputed("اغتصب المتهم الضحية وادعى الرضا."),
  "contested");

check("أنكر الإكراه — denied coercion → contested",
  factsMatchConsentDisputed("جامعها المتهم وأنكر الإكراه وادعى التراضي."),
  "contested");

check("قبّلها — kiss, no contest → refused",
  factsMatchConsentDisputed("قبّلها المتهم بالقوة أمام الشهود."),
  "refused");

check("no sexual act → null",
  factsMatchConsentDisputed("سرق المتهم المحفظة من حقيبتها."),
  null);

check("تزوجها — marriage is not in _SEXUAL_ACT_KW → null",
  factsMatchConsentDisputed("تزوجها بعقد شرعي."),
  null);

// ── articleBadgeLabel unit (R61 spec) ───────────────────────────────────────
// Art. 152 has legal_status "disputed" in the DB; verify the label resolves correctly.
console.log("\narticleBadgeLabel unit\n" + "─".repeat(70));
function articleBadgeLabel(legalStatus) {
  switch (legalStatus) {
    case "in_force":          return "ساري";
    case "disputed":          return "يحتاج مراجعة";
    case "repealed":          return "ملغى";
    case "amended":           return "معدَّل";
    case "not_yet_in_force":  return "لم يدخل حيز النفاذ";
    default:                  return "غير محدد";
  }
}
check('legal_status "disputed" → "يحتاج مراجعة"', articleBadgeLabel("disputed"), "يحتاج مراجعة");
check('legal_status "in_force" → "ساري"',          articleBadgeLabel("in_force"), "ساري");
check('legal_status "repealed" → "ملغى"',          articleBadgeLabel("repealed"), "ملغى");
check('legal_status "amended" → "معدَّل"',          articleBadgeLabel("amended"), "معدَّل");
check('legal_status null → "غير محدد"',            articleBadgeLabel(null), "غير محدد");

// ── Summary ─────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(70));
console.log(`${passed}/${total} passed`);
console.log(allPassed ? "ALL PASSED" : "FAILURES");
process.exit(allPassed ? 0 : 1);
