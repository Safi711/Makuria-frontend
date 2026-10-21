// factsMatchDelivery verification (Commit 41)
import { factsMatchDelivery } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── POSITIVES — delivery verb un-negated, no رفض guard ────────────────────
  ["دفعت المبلغ كاملاً إلى الشخص المطلوب منه بعد أن أرسل لها رسالة تهديدية.",
    true,  "DP1  B13-125 pattern — دفعت un-negated → true"],
  ["حوّل المبلغ المطلوب عبر الحساب البنكي خوفاً من التهديد.",
    true,  "DP2  حوّل (= حول after normalisation) → true"],
  ["سلّم له المبلغ نقداً في الموعد المحدد.",
    true,  "DP3  سلّم (= سلم) → true"],
  ["أعطاه المبلغ المطلوب كاملاً.",
    true,  "DP4  أعطاه → true"],
  ["سدّد الدين الذي طالبه به تحت الإكراه.",
    true,  "DP5  سدّد (= سدد) → true"],

  // ── NEGATIVES — negated verb, رفض guard, or no delivery ──────────────────
  ["أرسل له رسالة يطلب فيها تحويل مبلغ وإلا فضح أمره، غير أن المجني عليه رفض الدفع وأبلغ الشرطة.",
    false, "DN1  B13-126 — رفض + الدفع within 3 → false"],
  ["طالبها بتحويل المبلغ تهديداً، ولكنها رفضت الدفع.",
    false, "DN2  رفضت + الدفع → false"],
  ["لم يدفع المبلغ المطلوب ورفض الاستجابة للتهديد.",
    false, "DN3  لم يدفع (negated) + رفض → false"],
  ["أرسل رسالة تهديدية ولم تحوّل أي مبلغ.",
    false, "DN4  لم تحوّل (negated) → false"],
  ["هدده بنشر الصور إذا لم يدفع.",
    false, "DN5  لم يدفع (negated, conditional) → false"],
  ["رفضت التحويل وأبلغت الشرطة فوراً.",
    false, "DN6  رفضت + التحويل within 3 → false"],
];

function runSuite(tests, fn) {
  let allPassed = true;
  console.log("\nfactsMatchDelivery\n" + "─".repeat(80));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "YES     " : "NO      "}] got=${got}  "${text.slice(0, 65)}"  (${note})`);
  }
  console.log("─".repeat(80));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const passed = runSuite(tests, factsMatchDelivery);
process.exit(passed ? 0 : 1);
