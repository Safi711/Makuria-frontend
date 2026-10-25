/**
 * Unit tests for factsMatchTrustDisposal and factsMatchTrustDenial (Commit 50).
 * Run: node lib/case-mapper/__tests__/test-kw-trust.mjs
 */
import {
  factsMatchTrustDisposal,
  factsMatchTrustDenial,
  factsMatchTrustNonReturn,
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

console.log("\ntest-kw-trust");
console.log("─".repeat(60));

// T1 — B13-122 verbatim: participation + mere non-return, no disposal, no denial
const F1 = "سلّم صاحب المحل بضاعةً بالأمانة إلى شخص وشريكه لبيعها ورد ثمنها إليه في أجل محدد، غير أنهما لم يردا الثمن ولم يعيدا البضاعة عند المطالبة.";
test("T1 B13-122: disposal → false", () => eq(factsMatchTrustDisposal(F1), false));
test("T1 B13-122: denial  → null",  () => eq(factsMatchTrustDenial(F1),  null));

// T2 — refusal to return, receipt admitted, no fate stated → disposal false, denial null
const F2 = "سلّم التاجر لعامله مبلغاً ليشتري به بضاعة، فأقرّ العامل باستلامه لكنه رفض ردّه عند المطالبة.";
test("T2: disposal → false (رفض is mere refusal, not disposal)", () => eq(factsMatchTrustDisposal(F2), false));
test("T2: denial  → null  (no denial marker)",                    () => eq(factsMatchTrustDenial(F2),  null));

// T3 — denial with receipt evidence (إيصال موقع) → supported
const F3 = "سلّم أحمد صديقه مبلغاً على سبيل الأمانة، فأنكر الصديق استلامه، وقدّم أحمد إيصالاً موقعاً منه بالاستلام.";
test("T3: disposal → false",           () => eq(factsMatchTrustDisposal(F3), false));
test("T3: denial  → \"supported\"",    () => eq(factsMatchTrustDenial(F3),   "supported"));

// T4 — bare claim handover + denial + negated support → bare
const F4 = "يدعي أحمد أنه سلّم صديقه مبلغاً على سبيل الأمانة، وينكر الصديق أنه استلم شيئاً، ولا يوجد إيصال أو شهود.";
test("T4: disposal → false",        () => eq(factsMatchTrustDisposal(F4), false));
test("T4: denial  → \"bare\"",      () => eq(factsMatchTrustDenial(F4),   "bare"));

// T5 — B15-150 verbatim: دخلتها في شغل تاني → disposal true
const F5 = "أنا أديت صاحبي عشرة مليون جنيه عشان يشتري لي عربية من السوق. بعد أسبوع جاني قال العربية غليت والقروش ما كفت. قلت ليهو رجّع قروشي، قال لي: «والله القروش دخلتها في شغل تاني، لكن حأرجعها ليك». بعدين اكتشفت إنو من يوم استلم القروش ما مشى سوق العربات أصلاً. هو بقول كان ناوي يشتري العربية لكن جاتو فرصة تجارة وخاف تفوتو.";
test("T5 B15-150: disposal → true (دخلتها في شغل تاني)", () => eq(factsMatchTrustDisposal(F5), true));

// T6 — استخدم + سداد دين على شقيقه → disposal true
const F6 = "سلّم صاحب المحل موظفه مبلغاً لإيداعه في البنك، فاستخدمه الموظف في سداد دين على شقيقه ووعد بردّه.";
test("T6: disposal → true (استخدمه في سداد دين)", () => eq(factsMatchTrustDisposal(F6), true));

// T7 — ضاعت منه (gross-negligence gap) → disposal false, denial null
const F7 = "سلّم التاجر وكيله بضاعة ليبيعها، فلم يرد الثمن، وقال إن البضاعة ضاعت منه أثناء النقل.";
test("T7: disposal → false (ضاع is not disposal; gross-negligence gap out of scope)", () => eq(factsMatchTrustDisposal(F7), false));
test("T7: denial  → null  (no denial marker)",                                        () => eq(factsMatchTrustDenial(F7),  null));

// T8 — B14-139 verbatim: باعها + أنكر استلامها + narrative handover
const F8 = "سلّم صاحب المحل للمتهم بضاعة لإيصالها للزبون، فباعها لنفسه وأنكر استلامها.";
test("T8 B14-139: disposal → true  (باعها لنفسه)",              () => eq(factsMatchTrustDisposal(F8), true));
test("T8 B14-139: denial  → \"supported\" (narrative handover)", () => eq(factsMatchTrustDenial(F8),   "supported"));

// T9 — B14-133 verbatim: أنفقه على نفسه → disposal true
const F9 = "استلم المتهم من صاحب المحل مبلغاً لشراء بضاعة، فأنفقه على نفسه وأنكر استلامه.";
test("T9 B14-133: disposal → true (أنفقه على نفسه)", () => eq(factsMatchTrustDisposal(F9), true));

// T10 — local negation: ولم يصرف → spend verb negated → disposal false
const F10 = "سلّم الشاكي المتهم مبلغاً ليشتري له سيارة، ولم يصرف المتهم المبلغ على نفسه، لكنه لم يرده حتى الآن.";
test("T10: disposal → false (ولم يصرف — local negation)", () => eq(factsMatchTrustDisposal(F10), false));

// ── factsMatchTrustNonReturn tests ─────────────────────────────────────────────

console.log("\nfactsMatchTrustNonReturn");
console.log("─".repeat(60));

// TNR-T1 — B13-122: سلّم + لم يردا → true
test("TNR-T1 B13-122 → true", () => eq(factsMatchTrustNonReturn(F1), true));

// TNR-T2 — T2: سلّم + رفض ردّه → true
test("TNR-T2 (رفض ردّه) → true", () => eq(factsMatchTrustNonReturn(F2), true));

// TNR-T3 — T3: سلّم + أنكر استلامه → true
test("TNR-T3 (أنكر استلامه) → true", () => eq(factsMatchTrustNonReturn(F3), true));

// TNR-T4 — T4: claim-context سلّم + ينكر → true
test("TNR-T4 (ينكر) → true", () => eq(factsMatchTrustNonReturn(F4), true));

// TNR-T6 — T6: سلّم + استخدمه → true
test("TNR-T6 (استخدمه) → true", () => eq(factsMatchTrustNonReturn(F6), true));

// TNR-T7 — T7: سلّم + لم يرد → true (gross-negligence gap is handled above the gate)
test("TNR-T7 (لم يرد) → true", () => eq(factsMatchTrustNonReturn(F7), true));

// TNR-NEG1 — paid in full; no non-return marker → false
const F_NEG1 = "سلّم التاجر المبلغ للمورد ثمناً للبضاعة واستلمها كاملة.";
test("TNR-NEG1 (paid in full) → false", () => eq(factsMatchTrustNonReturn(F_NEG1), false));

// TNR-NEG2 — handover itself is negated → false
const F_NEG2 = "لم يسلّم الشاكي المتهم أي مبلغ، ويطالبه بدين قديم.";
test("TNR-NEG2 (negated handover) → false", () => eq(factsMatchTrustNonReturn(F_NEG2), false));

console.log("─".repeat(60));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
