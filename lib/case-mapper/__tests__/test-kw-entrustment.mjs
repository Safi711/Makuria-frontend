// factsMatchEntrustment verification (Commit 46)
import { factsMatchEntrustment } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── E1–E5: lawyer's acceptance cases ──────────────────────────────────────
  ["أودع العميل أموالاً في البنك وتعذر عليه سحبها",
    false, "E1  bank-recipient guard → false"],
  ["وضع العميل مبلغاً في حسابه المصرفي ورفض البنك رده",
    false, "E2  bank-recipient guard (وضع + مصرف) → false"],
  ["سلّم شخص صديقه مبلغاً لحفظه فأنكر استلامه",
    true,  "E3  handover + purpose(لحفظه) + non-return → true"],
  ["سلّم صاحب العمل موظفه مبلغاً لإيداعه بالبنك فاستولى عليه",
    true,  "E4  person-trustee present (موظفه) → guard does not fire → true"],
  ["حوّل شخص مبلغاً عبر البنك إلى شخص مؤتمن فاختلسه",
    true,  "E5  bank is channel not recipient → guard does not fire → true"],

  // ── POSITIVES — additional ─────────────────────────────────────────────────
  // B14-133: classic breach-of-trust
  ["استلم المتهم من صاحب المحل مبلغاً لشراء بضاعة، فأنفقه على نفسه وأنكر استلامه.",
    true,  "B14-133  استلم + لشراء + أنكر استلامه → true"],
  // B14-139: delivery to customer
  ["سلّم صاحب المحل للمتهم بضاعة لإيصالها للزبون، فباعها لنفسه وأنكر استلامها.",
    true,  "B14-139  سلّم + لإيصالها(لإيصال) + باعها → true"],
  // B13-129: agency with diversion
  ["سلّمته مبلغاً على أن يشتري لها قطعة أرض، فتصرّف في المبلغ لنفسه.",
    true,  "B13-129  سلّمته + على أن + تصرّف → true"],
  // lawyer fact (R66 core)
  ["سلمت المتهم مبلغاً لشراء بضائع لحسابها، بموجب اتفاق بينهما، لم يسلم المتهم البضائع ولم يرد المبلغ، وأفاد بأن الأموال استُخدمت في معاملات تجارية أخرى.",
    true,  "R66-core  سلمت + لشراء + لم يسلم + استُخدمت → true"],

  // ── NEGATIVES ─────────────────────────────────────────────────────────────
  ["اشترى بضاعة ودفع ثمنها",
    false, "purchase: no non-return → false"],
  ["اتفقا على شراكة وخسرت الشركة",
    false, "partnership loss: no handover + no non-return → false"],
  ["أودع المتهم مبلغاً في البنك الأهلي ولم يستطع سحبه لاحقاً",
    false, "E1-variant: bank guard (أودع + البنك) → false"],
  ["أودع المتهم أموالاً في حساب مصرفي ورفض البنك ردها",
    false, "حساب مصرفي guard → false"],
];

function runSuite(tests, fn) {
  let allPassed = true;
  console.log("\nfactsMatchEntrustment\n" + "─".repeat(80));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "YES     " : "NO      "}] got=${got}  "${text.slice(0, 70)}"  (${note})`);
  }
  console.log("─".repeat(80));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const passed = runSuite(tests, factsMatchEntrustment);
process.exit(passed ? 0 : 1);
