// Dry run of the 100 original cases (Nov 3): three keyword-gate fixes.
import { factsMatchAccidentMarker, factsMatchDelivery, factsMatchEntrustment, factsStateAcquisitionUnclear } from "../kw-matcher.mjs";
const cases = [
  ["B4-034 «دون إذن بقصد» ليست «دون قصد»", factsMatchAccidentMarker, "تجاوز المتهم سور عقار في حيازة المجني عليه ودخل إليه دون إذن بقصد مضايقته، ثم رفض الخروج عند مطالبته بذلك.", false],
  ["«دون قصد» ما زالت حادثاً عرضياً", factsMatchAccidentMarker, "كسر زجاج السيارة دون قصد", true],
  ["«بدون قصد»", factsMatchAccidentMarker, "أتلف الباب بدون قصد", true],
  ["«من غير قصد»", factsMatchAccidentMarker, "كسر الهاتف من غير قصد", true],
  ["B8-078 «أجبره على تسليم» تسليم تمّ", factsMatchDelivery, "اعترض المتهم المجني عليه أثناء سيره، وهدده بأداة حادة، ثم أجبره على تسليم هاتفه ونقوده.", true],
  ["طلب دون تسليم", factsMatchDelivery, "هدده بنشر صوره وطلب منه مبلغاً", false],
  ["B7-070 «لم يوضح كيف» لا أمانة", factsMatchEntrustment, "ذكر المشتكي أن المتهم أخذ سيارته ولم يعدها. لم يوضح كيف حصل المتهم على السيارة، أو ما إذا كان قد أخذها دون إذن أو تسلمها بموجب اتفاق، أو ما حدث لها لاحقًا.", false],
  ["أمانة صريحة ما زالت تعمل", factsMatchEntrustment, "سلمت صديقي سيارتي ليوصل بها أولاده للمدرسة لمدة أسبوع، ولم يعدها حتى الآن ورفض إرجاعها.", true],
  ["«لم تبين كيف»", factsStateAcquisitionUnclear, "لم تبين الشاكية كيف وصل المال إليه", true],
  ["«لم يوضح السبب» ليست جهلاً بالحيازة", factsStateAcquisitionUnclear, "تأخر في السداد ولم يوضح السبب", false],
];
let p = 0;
for (const [name, fn, facts, want] of cases) {
  const got = fn(facts);
  console.log(`${got === want ? "✓" : "✗"} ${name} → ${got}`);
  if (got === want) p++;
}
console.log(`${p}/${cases.length}`);
if (p !== cases.length) process.exit(1);
