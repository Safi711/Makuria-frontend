// Impersonation gate — 16-row runnable test.
// Matches the approved rules in docs/abu-rannat-impersonation-gate.md.
// Uses real functions from kw-matcher.mjs (no inline copies).
// Run with: node lib/case-mapper/__tests__/test-impersonation-gate.mjs
import {
  normalizeForKwMatch,
  factsMatchKeywords,
  factsMatchClaimMarker,
  factsMatchMoneyTake,
  PUBLIC_OFFICIAL_KW,
  IMPOSTOR_VERB_KW,
} from "../kw-matcher.mjs";

function proximityGate(facts) {
  return factsMatchKeywords(facts, IMPOSTOR_VERB_KW) &&
         factsMatchClaimMarker(facts, PUBLIC_OFFICIAL_KW);
}
function moneyTakeGate(facts) {
  return factsMatchMoneyTake(facts);
}

// ── 16-row test table ────────────────────────────────────────────────────────
// Expected values: PROX=prox only, MONEY=money only, BOTH=prox+money, NONE=neither
const T = { PROX:"PROX", MONEY:"MONEY", BOTH:"BOTH", NONE:"NONE" };

const tests = [
  // Must FIRE (proximity gate = true)
  ["قبض المبلغ منتحلاً صفة ضابط",
   T.BOTH, "صفه→CM, ضابط; قبض not followed by على; مبلغ"],
  ["مدعياً أنه من المباحث",
   T.PROX, "انه→CM, من=filler, المباحث→مباحث"],
  ["أوهم المجني عليه بأنه موظف في مكتب الأراضي",
   T.PROX, "بانه→CM, موظف (no ل)"],
  ["ادعى أنه ضابط",
   T.PROX, "انه→CM, ضابط"],
  ["تظاهر بأنه مأمور",
   T.PROX, "بانه→CM, مامور"],
  ["متظاهراً بأنه موظف حكومي",
   T.PROX, "بانه→CM, موظف"],
  ["ادعى أنه يعمل ضابطاً في الشرطة",
   T.PROX, "انه→CM, يعمل=filler, ضابطاً → ضابط + suffix ا"],

  // Must NOT fire (proximity gate = false)
  ["ادعى الشاكي أن المتهم احتال عليه في بيع عربة، والشاكي موظف بوزارة الصحة",
   T.NONE, "أن≠أنه; موظف never in claim-marker window"],
  ["زعم المتهم أنه سدد المبلغ كاملاً للموظف المختص",
   T.NONE, "انه→CM, سدد not official, not filler → blocked; للموظف starts ل"],
  ["زعم المتهم أنه سدد المبلغ للموظف المختص",
   T.NONE, "same without كاملاً; سدد not filler → blocked"],
  ["استلم المبلغ من الموظف المختص",
   T.MONEY, "money only (استلم+مبلغ); no impostor verb → prox=false"],
  ["ادعى أنه سدد المبلغ",
   T.NONE, "انه→CM, سدد not official, not filler → blocked"],
  ["أقر بأنه موظف حكومي",
   T.NONE, "أقر not in IMPOSTOR_VERB_KW → condition A fails"],

  // Money-taking gate
  ["ادعى أنه ضابط وأوقف العربة وطلب الرخصة، وكان مع السائق مبلغ كبير",
   T.PROX, "prox fires; مبلغ present but no taking verb → PROX only, no override"],
  ["ادعى أنه ضابط وقبض من الشاكي مبلغاً",
   T.BOTH, "prox fires; وقبض → single-char و comparison; مبلغاً→مبلغ+suffix ا"],

  // Row 16: قبض على = arrest
  ["ادعى أنه ضابط، وقبضت عليه الشرطة وبحوزته مبلغ",
   T.PROX, "prox fires; وقبضت ≠ و+قبض (extra suffix ت) → no taking-verb match → PROX only"],
];

let allOk = true;
console.log("Impersonation gate — 16-row test\n" + "─".repeat(76));
for (const [text, expected, note] of tests) {
  const prox  = proximityGate(text);
  const money = moneyTakeGate(text);
  let ok;
  if (expected === T.PROX)  ok = prox  && !money;
  if (expected === T.MONEY) ok = !prox && money;
  if (expected === T.BOTH)  ok = prox  && money;
  if (expected === T.NONE)  ok = !prox && !money;
  const label = expected === T.BOTH  ? "FIRE prox+money"
              : expected === T.PROX  ? "FIRE prox only "
              : expected === T.MONEY ? "FIRE money only"
              : "NO FIRE       ";
  if (!ok) allOk = false;
  const short = text.length > 50 ? text.slice(0,50)+"…" : text;
  console.log(`${ok?"✓":"✗"} [${label}] "${short}"`);
  if (!ok) {
    const toks = normalizeForKwMatch(text).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
    console.log(`  GOT: prox=${prox} money=${money}`);
    console.log(`  tokens: ${JSON.stringify(toks)}`);
  }
}
console.log("─".repeat(76));
console.log(allOk ? "ALL PASSED" : "FAILURES — see above");
process.exit(allOk ? 0 : 1);
