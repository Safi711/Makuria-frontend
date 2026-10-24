/**
 * Unit tests for factsMatchChequeDishonour, factsMatchChequeBalanceClaim,
 * factsMatchChequeStopCause (Commit 48).
 * Run: node lib/case-mapper/__tests__/test-kw-cheque.mjs
 */
import {
  factsMatchChequeDishonour,
  factsMatchChequeBalanceClaim,
  factsMatchChequeStopCause,
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

console.log("\ntest-kw-cheque");
console.log("─".repeat(50));

// Case 1 — B15-144: balance dishonour + balance claim
const F1 = "اشترى خالد بضائع من تاجر بمبلغ ١٢ مليون جنيه، وسلمه شيكاً بالمبلغ مستحق الدفع بعد شهر. وعند حلول الموعد أعاد البنك الشيك لعدم كفاية الرصيد. قال خالد إن حسابه كان يحتوي على المبلغ يوم تحرير الشيك، لكن أحد عملائه سحب تحويلاً متوقعاً قبل موعد الدفع، فلم يتمكن من تغطية الشيك.";
test("case 1: dishonour → balance", () => eq(factsMatchChequeDishonour(F1), "balance"));
test("case 1: balanceClaim → true", () => eq(factsMatchChequeBalanceClaim(F1), true));
test("case 1: stopCause → false", () => eq(factsMatchChequeStopCause(F1), false));

// Case 2 — B15-146: stop dishonour + stop cause
const F2 = "استلمت سارة شيكاً من محمد مقابل بيع سيارة. وعندما قدمته للبنك أعيد بسبب أمر سابق من محمد بإيقاف الصرف. أوضح محمد أنه أصدر الأمر بعدما اكتشف عيباً جوهرياً في السيارة، وأنه أبلغ سارة بذلك قبل تقديم الشيك. تؤكد سارة أن السيارة بيعت بالحالة التي عاينها محمد وأنه تسلمها واستعملها أسبوعين.";
test("case 2: dishonour → stop", () => eq(factsMatchChequeDishonour(F2), "stop"));
test("case 2: stopCause → true", () => eq(factsMatchChequeStopCause(F2), true));
test("case 2: balanceClaim → false", () => eq(factsMatchChequeBalanceClaim(F2), false));

// Case 3: stop order but cheque not presented → null
const F3 = "أصدر عمر شيكاً لصالح المورد ثم أمر البنك بإيقاف صرفه، ولم يُقدَّم الشيك للبنك بعد.";
test("case 3: stop without return → null", () => eq(factsMatchChequeDishonour(F3), null));

// Case 4: return negated → null
const F4 = "قدّم التاجر الشيك للبنك فصُرف ولم يرتد الشيك، ثم نشب خلاف حول جودة البضاعة.";
test("case 4: negated return → null", () => eq(factsMatchChequeDishonour(F4), null));

// Case 5: balance + denied knowledge via bank deduction
const F5 = "أُعيد الشيك لعدم كفاية الرصيد، وقال الساحب إنه لم يكن يعلم بنقص الرصيد لأن البنك خصم رسوماً دون إخطاره.";
test("case 5: dishonour → balance", () => eq(factsMatchChequeDishonour(F5), "balance"));
test("case 5: balanceClaim → true", () => eq(factsMatchChequeBalanceClaim(F5), true));

// Case 6: non-withdrawable balance + denied knowledge of seizure
const F6 = "ارتد الشيك لأن الرصيد غير قابل للسحب بسبب حجز قضائي على الحساب، وأنكر الساحب علمه بالحجز.";
test("case 6: dishonour → balance", () => eq(factsMatchChequeDishonour(F6), "balance"));
test("case 6: balanceClaim → true", () => eq(factsMatchChequeBalanceClaim(F6), true));

// Case 7: no-account only → null
const F7 = "أعاد البنك الشيك لأنه لا يوجد حساب بهذا الرقم أصلاً.";
test("case 7: no-account only → null", () => eq(factsMatchChequeDishonour(F7), null));

// Case 8: balance + no claim (drawer knew account was empty)
const F8 = "ارتد الشيك لعدم كفاية الرصيد، وكان الساحب يعلم أن حسابه فارغ منذ شهر.";
test("case 8: dishonour → balance", () => eq(factsMatchChequeDishonour(F8), "balance"));
test("case 8: balanceClaim → false", () => eq(factsMatchChequeBalanceClaim(F8), false));

// Case 9: stop + notice only (not a cause)
const F9 = "أُعيد الشيك بسبب أمر بإيقاف الصرف، وقال الساحب إنه أبلغ المستفيد قبل تقديمه.";
test("case 9: dishonour → stop", () => eq(factsMatchChequeDishonour(F9), "stop"));
test("case 9: stopCause → false (notice alone is not a cause)", () => eq(factsMatchChequeStopCause(F9), false));

// Case 10: no cheque → null
const F10 = "سلّم المشتري نقداً كاملاً ولم يستعمل شيكاً، ثم اكتشف عيباً في السيارة.";
test("case 10: no cheque → null", () => eq(factsMatchChequeDishonour(F10), null));

// Case 11: both balance and stop → stop (more specific)
const F11 = "أعيد الصك لعدم كفاية الرصيد وأيضاً بسبب أمر وقف صرف لاحق، بعد نزاع حول العقد.";
test("case 11: both reasons → stop", () => eq(factsMatchChequeDishonour(F11), "stop"));
test("case 11: stopCause → true", () => eq(factsMatchChequeStopCause(F11), true));

// Case 12: stop via فأعاده + non-delivery cause
const F12 = "أمر محمد البنك بوقف صرف الشيك فأعاده البنك، وقال إنه لم يتسلم البضاعة المتفق عليها.";
test("case 12: dishonour → stop", () => eq(factsMatchChequeDishonour(F12), "stop"));
test("case 12: stopCause → true", () => eq(factsMatchChequeStopCause(F12), true));

console.log("─".repeat(50));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
