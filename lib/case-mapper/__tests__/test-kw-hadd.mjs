// factsMatchHaddTheftConditions verification (Commit 41)
import { factsMatchHaddTheftConditions } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── POSITIVES (≥8) — all five groups explicitly stated ─────────────────────
  ["المتهم البالغ دخل سراً إلى المحل المغلق وسرق النقود المملوكة لصاحب المحل دون إذنه ولا شبهة في ملكيتها.",
    true,  "HP1  بالغ(i) + سراً(ii) + مغلق(iii) + لصاحب(iv) + لا شبهة(v)"],
  ["ثبت أن المتهم عاقل عمره 25 سنة أخذ المال خفيةً من الخزنة المحروسة المملوكة للغير دون إذن صاحبه ولا اضطرار.",
    true,  "HP2  عاقل+25(i) + خفية(ii) + خزنة+محروس(iii) + للغير(iv) + لا اضطرار(v)"],
  ["المتهم مختار في أفعاله، دخل في غفلة من أصحابه إلى الخزينة وأخذ المال مملوكاً لصاحبه ولا حصة له فيه.",
    true,  "HP3  مختار(i) + في غفلة(ii) + خزينة(iii) + مملوك ل...(iv) + لا حصة(v)"],
  ["راشد بالغ دخل ليلاً إلى المحل المقفول وسرق البضاعة لصاحب المحل ولا مطالبة له فيها.",
    true,  "HP4  راشد+بالغ(i) + ليلاً+مقفول(ii+iii) + لصاحب(iv) + لا مطالبة(v)"],
  ["المتهم واعٍ متخفياً دخل السور وأخذ المال ملكاً له لشخص آخر لم يكن مضطراً.",
    true,  "HP5  واعٍ(i) + متخفياً(ii) + سور(iii) + ملك ل(iv) + لم يكن مضطراً(v)"],
  ["المتهم عمره 30 سنة أخذ الأموال بدون علم أصحابها من المحل المغلق لصاحبه ولا ملكية له فيها دون إذن.",
    true,  "HP6  عمره30(i) + بدون علم(ii) + مغلق(iii) + لصاحبه(iv) + لا ملكية(v)"],
  ["بالغ عاقل دخل سرا إلى الخزنة المقفولة وسرق المبلغ المملوك لصاحب المحل ولا شبهة ملكية.",
    true,  "HP7  بالغ+عاقل(i) + سرا(ii) + خزنة+مقفول(iii) + لصاحب(iv) + لا شبهة(v)"],
  ["المتهم ثمانية عشر عاماً عاقل أخذ في غفلة المال من الحرز المملوك له أي لصاحبه ولا اضطرار للأخذ.",
    true,  "HP8  ثمانية عشر+عاقل(i) + في غفلة(ii) + حرز(iii) + لصاحبه(iv) + لا اضطرار(v)"],

  // ── NEGATIVES (≥8) — one or more groups missing or negated ─────────────────
  ["أخذ هاتف أخيه من الطاولة",
    false, "HN1  B12-04 pattern — no conditions stated at all"],
  ["سرق هاتفاً من الطاولة",
    false, "HN2  plain theft — table is not a hirz, no conditions"],
  // Missing capacity
  ["دخل سراً إلى المحل المغلق وسرق المال المملوك لصاحب المحل دون إذن ولا شبهة.",
    false, "HN3  no capacity stated → false"],
  // Missing secrecy
  ["البالغ وجد الباب مفتوحاً ودخل وأخذ المال من المحل المغلق المملوك لصاحبه دون إذن ولا شبهة.",
    false, "HN4  no secrecy marker (open door, no سراً/خفية/غفلة/ليلاً+مغلق combo) → false"],
  // Missing hirz (table is not secure storage)
  ["البالغ أخذ سراً المال الموضوع على الطاولة مملوكاً للغير دون إذن ولا شبهة.",
    false, "HN5  no hirz (open table) → false"],
  // Missing ownership-by-other (no لصاحب/للغير/مملوك ل present)
  ["البالغ دخل سراً إلى المحل المقفول وأخذ مالاً يظنه ملكه دون إذن.",
    false, "HN6  ownership phrase absent (يظنه ملكه has no ل-token after) → false"],
  // Missing no-doubt / no-necessity phrase
  ["البالغ دخل سراً إلى المحل المغلق وأخذ المال لصاحب المحل.",
    false, "HN7  no no-doubt/no-necessity phrase → false"],
  // Hirz negated by ليس
  ["البالغ دخل سراً وأخذ المال ليس في حرز المال مملوك لصاحبه دون إذن ولا شبهة.",
    false, "HN8  ليس في حرز → hirz group negated → false"],
  // B12-04 verbatim — no capacity stated
  ["أبلغت امرأة أن شقيقها أخذ هاتفها من المنزل دون إذنها وباعه لشخص آخر، ثم أخبرها بأنه سيعيد قيمته عندما تتحسن ظروفه المالية. وتؤكد أنها لم توافق على البيع.",
    false, "HN9  B12-04 verbatim — no capacity stated (شقيقها alone) → false"],
];

function runSuite(tests, fn) {
  let allPassed = true;
  console.log("\nfactsMatchHaddTheftConditions\n" + "─".repeat(80));
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

const passed = runSuite(tests, factsMatchHaddTheftConditions);
process.exit(passed ? 0 : 1);
