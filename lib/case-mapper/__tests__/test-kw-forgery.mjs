/**
 * Unit tests for factsMatchDocumentAlteration and factsMatchPublicOfficialFalseEntry
 * (Commit 49 — Arts. 122/123 forgery gate and Art. 124 public-official gate).
 * Run: node lib/case-mapper/__tests__/test-kw-forgery.mjs
 */
import {
  factsMatchDocumentAlteration,
  factsMatchPublicOfficialFalseEntry,
} from "../kw-matcher.mjs";

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${label}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg ?? ""}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

console.log("\ntest-kw-forgery");
console.log("─".repeat(50));

// Case 1 — B15-145 verbatim: blank-cheque overfill with authorization dispute
// alt=true (doc noun + non-negated alt verb + auth dispute), off124=false (no official)
const F1 = "سلّم عثمان شيكاً موقعاً على بياض إلى شريكه لتسديد فاتورة لا تتجاوز مليوني جنيه. ملأ الشريك الشيك بمبلغ ٩ ملايين جنيه وقدمه إلى البنك، فصرف البنك المبلغ من حساب عثمان. كان الشريك قد أُذن له بملء الشيك، لكن عثمان يؤكد أن الإذن كان محدداً بسقف المليونين، بينما يدعي الشريك أنه حصل على موافقة شفوية بالمبلغ الأكبر.";
test("case 1: alt → true  (blank-cheque overfill + auth dispute)", () => eq(factsMatchDocumentAlteration(F1), true));
test("case 1: off124 → false (no official)", () => eq(factsMatchPublicOfficialFalseEntry(F1), false));

// Case 2 — authorised fill, no dispute
// alt=false (no auth dispute phrase), off124=false
const F2 = "سلّم التاجر شيكاً موقعاً على بياض لوكيله، فملأه الوكيل بالمبلغ المتفق عليه وقدمه للبنك.";
test("case 2: alt → false (no auth dispute)", () => eq(factsMatchDocumentAlteration(F2), false));
test("case 2: off124 → false", () => eq(factsMatchPublicOfficialFalseEntry(F2), false));

// Case 3 — one verb negated, the other not; "دون إذن" as auth dispute
// alt=true (عدّل التاريخ non-negated + عقد + "دون إذن")
const F3 = "لم يغيّر الشريك المبلغ، لكنه عدّل التاريخ في العقد دون إذن من صاحبه.";
test("case 3: alt → true  (negated غيّر, non-negated عدّل + دون إذن)", () => eq(factsMatchDocumentAlteration(F3), true));

// Case 4 — denial verb ينكر is NOT a negator; غيّره is a valid alt verb
// alt=true (غيّره non-negated + الشيك + "دون إذنه")
const F4 = "ينكر المتهم تغيير المبلغ في الشيك، بينما يؤكد الشاكي أنه غيّره دون إذنه.";
test("case 4: alt → true  (ينكر not a negator; غيّره + الشيك + دون إذنه)", () => eq(factsMatchDocumentAlteration(F4), true));

// Case 5 — تعديل (masdar) does NOT match alteration verb; no auth dispute either
// alt=false (تعديل is not an alt verb; بموافقة الطرفين is not an auth-dispute phrase)
const F5 = "شهد موظف عام على تعديل بند في عقد خاص بين تاجرين، وقال إن التعديل تم بموافقة الطرفين.";
test("case 5: alt → false (تعديل is masdar, not alt verb)", () => eq(factsMatchDocumentAlteration(F5), false));
test("case 5: off124 → false (شهد = witness, no entry verb)", () => eq(factsMatchPublicOfficialFalseEntry(F5), false));

// Case 6 — أغفل المكلف بخدمة عامة عمداً إثبات واقعة صحيحة
// off124=true (omit verb + official within 6 + "واقعة صحيحة" within 10 + عمداً)
// alt=false (محضر is not a doc noun in the forgery list)
const F6 = "أغفل المكلف بخدمة عامة عمداً إثبات واقعة صحيحة في المحضر الذي حرره.";
test("case 6: off124 → true  (أغفل + official + واقعة صحيحة + عمداً)", () => eq(factsMatchPublicOfficialFalseEntry(F6), true));
test("case 6: alt → false (no doc noun from forgery list)", () => eq(factsMatchDocumentAlteration(F6), false));

// Case 7 — أثبت المسجل واقعة بيع لم تحدث مع علمه
// off124=true (أثبت + المسجل within 6 + لم تحدث within 10 + مع علمه)
const F7 = "أثبت المسجل في سجل الأراضي واقعة بيع لم تحدث، مع علمه بذلك.";
test("case 7: off124 → true  (أثبت + المسجل + لم تحدث + مع علمه)", () => eq(factsMatchPublicOfficialFalseEntry(F7), true));
test("case 7: alt → false (no doc noun)", () => eq(factsMatchDocumentAlteration(F7), false));

// Case 8 — موظف عام as complainant only; "بإضافة بند" detected as alt verb via masdar
// off124=false (موظف is complainant; no entry verb within 6 tokens of موظف)
// alt=true (بإضافة = إضافة masdar + عقد + دون إذنه)
const F8 = "تقدّم موظف عام ببلاغ يقول إن عقده الخاص زُوّر بإضافة بند دون إذنه.";
test("case 8: off124 → false (official is complainant, no entry verb nearby)", () => eq(factsMatchPublicOfficialFalseEntry(F8), false));
test("case 8: alt → true  (بإضافة masdar + عقد + دون إذنه)", () => eq(factsMatchDocumentAlteration(F8), true));

// Case 9 — حرّر + أثبت أقوال الشهود: no falsity marker → off124=false
// alt=false (محضر not in doc noun list)
const F9 = "حرّر الكاتب المحضر وأثبت فيه أقوال الشهود كما أدلوا بها.";
test("case 9: off124 → false (no knowledge marker; أقوال الشهود ≠ falsity marker)", () => eq(factsMatchPublicOfficialFalseEntry(F9), false));
test("case 9: alt → false (no doc noun)", () => eq(factsMatchDocumentAlteration(F9), false));

// Case 10 — أضاف بنداً to another contract; "في إذنه" is NOT an auth-dispute phrase
// alt=false (no auth dispute phrase matching the closed list)
const F10 = "أضاف المشتري بنداً إلى عقد آخر لا علاقة له بهذه الصفقة، ولم ينازع أحد في إذنه.";
test("case 10: alt → false (في إذنه not in auth-dispute list)", () => eq(factsMatchDocumentAlteration(F10), false));
test("case 10: off124 → false (no official)", () => eq(factsMatchPublicOfficialFalseEntry(F10), false));

// Case 11 — دوّن الموظف العام + "لم يدلِ بها" (3-token falsity marker in _FALSITY_ENTRY_NORMS)
// off124=true (false-entry path: دوّن + official within 1 + لم يدلِ بها within 10 after)
const F11 = "دوّن الموظف العام في محضر التحقيق أقوالاً لم يدلِ بها الشاهد.";
test("case 11: off124 → true  (دوّن + official + لم يدلِ بها)", () => eq(factsMatchPublicOfficialFalseEntry(F11), true));

// Case 12 — لم يثبت المسجّل: negated two-token omission signal + واقعة as object
// off124=true (omission path: لم يثبت + official within 2 + واقعة within 8 after)
const F12 = "لم يثبت المسجّل واقعة الرهن في السجل رغم تقديم المستندات إليه.";
test("case 12: off124 → true  (لم يثبت omission signal + المسجّل + واقعة)", () => eq(factsMatchPublicOfficialFalseEntry(F12), true));

// Case 13 — خطأ كتابي exclusion: clerical error in a document by a public official
// off124=false (clerical-error exclusion fires; no separate falsity marker overrides)
const F13 = "وقع خطأ كتابي في تاريخ الشهادة التي حررها الموظف العام.";
test("case 13: off124 → false (clerical-error exclusion)", () => eq(factsMatchPublicOfficialFalseEntry(F13), false));

// Case 14 — private-sector employee alters an invoice without authorisation
// off124=false (private-sector exclusion: شركة خاصة); alt=true (غيّر + فاتورة + دون إذنه)
const F14 = "غيّر موظف في شركة خاصة بيانات فاتورة العميل دون إذنه.";
test("case 14: off124 → false (private-sector: شركة خاصة)", () => eq(factsMatchPublicOfficialFalseEntry(F14), false));
test("case 14: alt → true  (غيّر + فاتورة + دون إذنه)", () => eq(factsMatchDocumentAlteration(F14), true));

// Case 15 — local negation لم يغيّر irrelevant; أغفل واقعة = true via omission path
// off124=true (omission path: أغفل + الكاتب within 3 + واقعة within 8 after)
const F15 = "لم يغيّر الكاتب المستند، لكنه أغفل إثبات واقعة الدفع عند تحريره.";
test("case 15: off124 → true  (أغفل + الكاتب + واقعة; لم يغيّر does not block)", () => eq(factsMatchPublicOfficialFalseEntry(F15), true));

// Case 16 — أنكر المأمور علمه: denial never blocks; كاذبة is falsity marker
// off124=true (false-entry path: دوّنها + المأمور within 6 + كاذبة within 10 after)
const F16 = "أنكر المأمور علمه بعدم صحة البيانات التي دوّنها، ويؤكد الشاكي أنها كاذبة.";
test("case 16: off124 → true  (دوّنها + المأمور within 6 + كاذبة; أنكر ≠ exclusion marker)", () => eq(factsMatchPublicOfficialFalseEntry(F16), true));

// Case 17 — تسلّم الموظف العام: recipient marker fires actor-binding exclusion
// off124=false (تسلّم within 5 tokens of official → exclusion); alt=false (no alt verb, no auth dispute)
const F17 = "تسلّم الموظف العام العقد من الطرفين وحفظه في الملف دون أي تعديل.";
test("case 17: off124 → false (تسلّم = recipient marker near official)", () => eq(factsMatchPublicOfficialFalseEntry(F17), false));
test("case 17: alt → false (no alt verb; تعديل is masdar not matched)", () => eq(factsMatchDocumentAlteration(F17), false));

console.log("─".repeat(50));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
