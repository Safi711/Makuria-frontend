/**
 * Unit tests for factsMatchAdminAppointmentReview (Commit 52).
 * Run: node lib/case-mapper/__tests__/test-kw-admin.mjs
 */
import { factsMatchAdminAppointmentReview } from "../kw-matcher.mjs";

let passed = 0;
let failed = 0;

function assert(id, got, expected) {
  if (got === expected) {
    console.log(`✓ ${id}`);
    passed++;
  } else {
    console.error(`✗ ${id}  expected ${JSON.stringify(expected)}  got ${JSON.stringify(got)}`);
    failed++;
  }
}

// ADM-T1: B15-143 verbatim → "fires"
assert(
  "ADM-T1",
  factsMatchAdminAppointmentReview(
    "أصدر مدير إحدى المؤسسات الحكومية قراراً بتعيين ابن شقيقه في وظيفة شاغرة دون إعلان أو منافسة. وكان ابن شقيقه مستوفياً للمؤهلات المطلوبة، لكن موظفين آخرين تقدموا بشكوى لأن إجراءات التعيين خالفت لائحة المؤسسة. لم يثبت أن المدير تلقى مالاً أو منفعة مادية مقابل القرار."
  ),
  "fires"
);

// ADM-NEG1: relative mentioned, no appointment act → null
assert(
  "ADM-NEG1",
  factsMatchAdminAppointmentReview(
    "زار ابن المدير المؤسسة وتحدث مع الموظفين دون أن يُعرض عليه أي منصب."
  ),
  null
);

// ADM-NEG2: appointment act, no kinship near it → null
assert(
  "ADM-NEG2",
  factsMatchAdminAppointmentReview(
    "أصدر المدير قراراً بتعيين موظف جديد في الوحدة دون إعلان أو منافسة."
  ),
  null
);

// ADM-NEG3: relative + appointment, no procedure negated → null
assert(
  "ADM-NEG3",
  factsMatchAdminAppointmentReview(
    "عيّن المدير ابن أخيه في وظيفة شاغرة وكان مستوفياً للشروط."
  ),
  null
);

// ADM-T2: relative + appointment + announcement negated → "fires"
assert(
  "ADM-T2",
  factsMatchAdminAppointmentReview(
    "قرر المدير تعيين ابنه مديراً للقسم دون إعلان عن الوظيفة."
  ),
  "fires"
);

// ADM-T3: relative + appointment + competition negated → "fires"
assert(
  "ADM-T3",
  factsMatchAdminAppointmentReview(
    "رقّى الوزير زوجته إلى درجة وظيفية أعلى دون منافسة مع المرشحين الآخرين."
  ),
  "fires"
);

// ADM-NEG4: spouse + promotion + competition negated → "fires"
assert(
  "ADM-NEG4",
  factsMatchAdminAppointmentReview(
    "رقى الوزير زوجته إلى درجة وظيفية أعلى دون منافسة مع المرشحين الآخرين."
  ),
  "fires"
);

// ADM-CONFLICT: announcement both affirmed and negated → "conflict"
assert(
  "ADM-CONFLICT",
  factsMatchAdminAppointmentReview(
    "تم الإعلان عن الوظيفة في الموقع الإلكتروني، غير أن شهوداً أفادوا بأن التعيين لابن الرئيس جرى دون إعلان فعلي."
  ),
  "conflict"
);

// ADM-NEG5: qualifications-only sentence, no kinship near appointment → null
assert(
  "ADM-NEG5",
  factsMatchAdminAppointmentReview(
    "حصل المتقدم على أعلى الدرجات في اختبار التعيين وأوصت لجنة الاختيار بتعيينه."
  ),
  null
);

// ADM-NEG6: زوجة mentioned but no appointment act → null
assert(
  "ADM-NEG6",
  factsMatchAdminAppointmentReview(
    "زوجة الوزير حضرت اجتماع المجلس ولم يُعرض عليها أي منصب."
  ),
  null
);

// ADM-NEG7: زوجته appears but too far from appointment act to be the beneficiary → null
assert(
  "ADM-NEG7",
  factsMatchAdminAppointmentReview(
    "عيّن الوزير موظفاً جديداً في وحدة التخطيط وأشار في سياق التقرير إلى أن زوجته تعمل في القطاع الخاص."
  ),
  null
);

// ADM-NEG8: procedures affirmed, relative appointed → null (no negation present)
assert(
  "ADM-NEG8",
  factsMatchAdminAppointmentReview(
    "جرى إعلان عن الوظيفة وأجريت منافسة شفافة، ثم عُيّن ابن المدير بعد أن حصل على أعلى الدرجات."
  ),
  null
);

// ADM-T4: promotion + relative + competition negated → fires; card must carry no violation claim
assert(
  "ADM-T4",
  factsMatchAdminAppointmentReview(
    "رقّى الرئيس التنفيذي ابنته إلى درجة مدير عام دون منافسة بين المرشحين."
  ),
  "fires"
);
// Static check: the card caution and description do not assert a violation
const CAUTION_TEXT = "هذه بطاقة فحص، وليست حكماً ببطلان القرار أو بثبوت جريمة أو انتفائها.";
const DESC_TAIL    = "القرابة وحدها لا تحسم عدم المشروعية أو قيام جريمة.";
assert(
  "ADM-T4-card-no-violation",
  CAUTION_TEXT.includes("بطاقة فحص") && !CAUTION_TEXT.includes("يجب") && !CAUTION_TEXT.includes("مخالف")
    && DESC_TAIL.includes("لا تحسم") && !DESC_TAIL.includes("يجب") && !DESC_TAIL.includes("مخالف"),
  true
);

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) { console.error("FAILURES — do not commit"); process.exit(1); }
else console.log("ALL PASSED");
