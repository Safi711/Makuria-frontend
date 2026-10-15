/**
 * Unit test for factsNegateIntentToKill.
 * Run: node lib/case-mapper/__tests__/test-kw-negate-intent.mjs
 *
 * FIRE cases: narrator-level negation (دون قصد قتله / لم يكن يقصد / بغير قصد القتل…)
 * NO FIRE:   accused's own speech via نفى / أنكر / قال etc.
 */

import { factsNegateIntentToKill } from "../kw-matcher.mjs";

const ROWS = [
  // ── FIRE (narrator states no intent) ─────────────────────────────────────
  [true,  "دون قصد قتله",                                                        "explicit دون قصد قتله"],
  [true,  "ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي.",            "O1: دون قصد قتله"],
  [true,  "ضربه بعصا على رأسه ولم يكن ذلك بقصد قتله فتوفي.",                    "ولم يكن ذلك بقصد قتله"],
  [true,  "طعنه بسكين في صدره دون أن يقصد قتله فتوفي.",                          "دون أن يقصد قتله"],
  [true,  "أطلق عليه عياراً نارياً لتخويفه ولم يكن يقصد قتله فأصابه فمات.",      "ولم يكن يقصد قتله"],
  [true,  "ضربه بعصا على رأسه ولم يكن ذلك بقصد قتله فتوفي.",                    "ولم يكن بقصد (with ذلك)"],
  [true,  "اعتدى عليه بغير قصد القتل فمات.",                                     "بغير قصد القتل"],
  [true,  "ولم يقصد قتله فتوفي متأثراً بجراحه.",                                 "ولم يقصد قتله"],
  // ── NO FIRE (accused's denial via speech verb) ───────────────────────────
  [false, "طعن المتهم المجني عليه بسكين في صدره فتوفي، ونفى أنه أراد قتله.",     "نفى — speech verb"],
  [false, "أطلق المتهم النار فأرداه قتيلاً، وأنكر قصد القتل.",                   "أنكر — speech verb"],
  [false, "طعنه بسكين في بطنه فمات، وقال المتهم إنه لم يقصد قتله.",             "قال + لم — accused speech"],
  [false, "لكم المجني عليه حتى مات، وقال إنه لم يقصد قتله.",                    "قال إنه لم يقصد"],
  [false, "ضربه بعصا فتوفي، ونفى المتهم أنه أراد قتله.",                         "نفى أنه أراد — no نفى kill intent pattern"],
  [false, "ضرب المتهم المجني عليه بعصا على رأسه فتوفي بعد يومين.",              "no negation phrase at all"],
  [false, "طعنه بسكين في صدره فتوفي.",                                            "no negation phrase at all"],
  [false, "أخذ المال دون إذن صاحبه.",                                             "دون without قصد/يقصد near قتل"],
  // ── Commit 22: narrator لا form + defence-plea speech verbs ─────────────
  [true,  "طعنه بسكين في صدره وهو لا يقصد قتله فتوفي.",                          "لا يقصد — narrator لا negation"],
  [false, "طعنه بسكين فمات، ودفع محاميه بأنه لم يقصد قتله.",                    "دفع محاميه بأن — defence plea"],
  [true,  "دفعه من على السلم دون قصد قتله فمات.",                                 "دفعه (pushed) is not a speech verb"],
  [false, "طعنه بسكين فمات، وتمسك بأنه لم يقصد قتله.",                          "تمسك — defence speech verb"],
  [false, "طعنه بسكين فمات، وصرح بأنه لم يقصد قتله.",                           "صرح — defence speech verb"],
  [false, "طعنه بسكين فمات، وأقر بأنه لم يقصد قتله.",                           "أقر — defence speech verb"],
  [false, "طعنه بسكين فمات، واعترف بأنه لم يقصد قتله.",                         "اعترف — defence speech verb"],
  // ── B1–B4: extended intent roots, kill targets, ما negator, speaker rule ──
  [true,  "ويؤكد مقدم البلاغ، الذي شاهد الحادث، أن الطاعن لم يكن يريد قتل المجني عليه",   "T1: يريد — reporter affirms no intent"],
  [true,  "طعنه بسكين ولم يُرد قتله",                                            "T2: يرد (jussive) — لم يُرد"],
  [true,  "ضربه بالساطور دون أن ينوي قتله",                                      "T3: ينوي — دون أن ينوي"],
  [true,  "أطلق عليه النار بغير نية القتل",                                       "T4: نية — بغير نية القتل"],
  [true,  "أفاد الشاهد بأن المتهم لم يقصد قتله",                                 "T5: أفاد + الشاهد → witness speaker, no veto"],
  [true,  "وذكر شهود العيان أن الجاني لم يكن قاصداً قتله",                       "T6: ذكر + شهود → witness speaker, no veto"],
  [true,  "طعنه بالسكين وما كان قاصد يقتله",                                     "T7: ما كان + قاصد — colloquial ما negator"],
  [true,  "ضربه بالسكين وما كان داير يكتلو",                                      "T8: ما كان داير — colloquial + يكتلو"],
  [true,  "طعنه في بطنه ولم يتعمد إزهاق روحه",                                   "T9: يتعمد + إزهاق — new intent root + kill target"],
  [true,  "ضربه بالفأس دون أن يقصد موته",                                         "T10: موته — new kill target"],
  [false, "أقر المتهم بإطلاق الرصاصة، لكنه أنكر أن يكون قد قصد قتل المجني عليه، وذكر محاميه أن موكله أراد تخويفه فقط", "F1: accused plea + defence lawyer — no negator particle"],
  [false, "قال المتهم إنه لم يكن يريد قتله",                                      "F2: قال + المتهم (accused) → veto"],
  [false, "وقال إنه ما كان قاصد يقتله",                                           "F3: قال + unnamed → veto; ما conditional"],
  [false, "ولم يرد في أقوال الشهود ما يوضح الغرض من إطلاق النار",               "F4: يرد = يَرِد (appeared), no kill target nearby"],
  [false, "دفع محاميه بأنه لم ينوِ قتله",                                         "F5: دفع محاميه — defence plea with ينو"],
  [false, "أفاد المتهم أمام الشاهد أنه لم يقصد قتله",                             "F6: أفاد + المتهم (first speaker noun = accused) → veto"],
  [false, "ما قاله الشاهد عن قتله غير صحيح",                                      "F7: ما not negator (follows قاله, not كان/قاصد/داير/ناوي)"],
  [false, "لم يكن يريد بيع الأرض فقتله",                                          "F8: فقتله has ف prefix → rejected as kill target"],
  [false, "طعنه بحسن نية",                                                         "F9: حسن النية is not a negation of intent to kill"],
];

let passed = 0;
let failed = 0;
console.log("factsNegateIntentToKill fire/no-fire");
console.log("─".repeat(80));
for (const [expected, facts, label] of ROWS) {
  const got = factsNegateIntentToKill(facts);
  const ok = got === expected;
  const tag = expected ? "FIRE    " : "NO FIRE ";
  console.log(`${ok ? "✓" : "✗"} [${tag}] got=${got}  "${label}"`);
  if (ok) passed++;
  else {
    failed++;
    console.log(`  MISMATCH: expected=${expected}  facts="${facts}"`);
  }
}
console.log("─".repeat(80));
if (failed === 0) console.log("ALL PASSED");
else { console.log(`FAILED: ${failed}/${ROWS.length}`); process.exit(1); }
