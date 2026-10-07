// Impersonation gate — 16-row runnable test.
// Matches the approved rules in docs/abu-rannat-impersonation-gate.md.
// Run with: node lib/case-mapper/__tests__/test-impersonation-gate.mjs

function stripTashkeel(t) { return t.replace(/[ً-ْٰ]/g, ""); }
function normalizeForKwMatch(t) {
  return stripTashkeel(t)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}
const KW_ARTICLE_PREFIXES = ["وال","فال","بال","كال","لل","ال","و","ف","ب","ك"];
function stripKwArticle(token) {
  for (const p of KW_ARTICLE_PREFIXES)
    if (token.startsWith(p) && token.length > p.length + 1) return token.slice(p.length);
  return token;
}
function tokenMatchesKw(textToken, kwToken) {
  if (textToken === kwToken) return true;
  const stripped = stripKwArticle(textToken);
  if (stripped === kwToken) return true;
  if (textToken.startsWith(kwToken) && textToken.length > kwToken.length) return true;
  if (stripped !== textToken && stripped.startsWith(kwToken) && stripped.length > kwToken.length) return true;
  return false;
}
function factsMatchKeywords(facts, keywords) {
  const normFacts = normalizeForKwMatch(facts);
  const factsTokens = normFacts.split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean);
  for (const kw of keywords) {
    const kwTokens = normalizeForKwMatch(kw).split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean);
    if (kwTokens.length === 0) continue;
    if (kwTokens.length === 1) {
      if (factsTokens.some(t => tokenMatchesKw(t, kwTokens[0]))) return true;
    } else {
      const n = kwTokens.length;
      for (let i = 0; i <= factsTokens.length - n; i++)
        if (kwTokens.every((kt, j) => tokenMatchesKw(factsTokens[i + j], kt))) return true;
    }
  }
  return false;
}

const CLAIM_MARKERS = new Set(["أنه","بأنه","صفة","شخصية"].map(normalizeForKwMatch));
const FILLER_TOKENS = new Set(["من","يعمل","في","أحد","أفراد"].map(normalizeForKwMatch));
const ARREST_POSTFIX = new Set(["على","عليه","عليهم","عليها","عليهن"].map(normalizeForKwMatch));

const PUBLIC_OFFICIAL_KW = [
  "موظف","موظفين","موظفي","ضابط","ضباط","مأمور","وزارة","حكومي","مباحث",
];
const IMPOSTOR_VERB_KW = [
  "انتحل","منتحل","انتحال صفة",
  "ادعى","مدعي",
  "زعم",
  "أوهم",
  "تظاهر","متظاهر",
  "قدم نفسه",
];
const TAKING_VERB_KW = ["قبض","استلم","أخذ","تسلم","تحصل","حصل على"];
const MONEY_NOUN_KW = ["مبلغ","مال","أموال","مبالغ","نقود","فلوس","ثمن","رسوم","دفعة"];

function factsMatchClaimMarker(facts, officialKws) {
  const normFacts = normalizeForKwMatch(facts);
  const tokens = normFacts.split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean);
  const normOffKws = officialKws
    .map(k => normalizeForKwMatch(k).split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean)[0])
    .filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (!CLAIM_MARKERS.has(tokens[i])) continue;
    for (let skip = 0; skip <= 2; skip++) {
      const j = i + 1 + skip;
      if (j >= tokens.length) break;
      let allFillers = true;
      for (let k = i + 1; k < j; k++) {
        if (!FILLER_TOKENS.has(tokens[k])) { allFillers = false; break; }
      }
      if (!allFillers) break;
      if (tokens[j].startsWith("ل")) continue;
      if (normOffKws.some(ok => tokenMatchesKw(tokens[j], ok))) return true;
    }
  }
  return false;
}

function factsMatchMoneyTake(facts) {
  const normFacts = normalizeForKwMatch(facts);
  const tokens = normFacts.split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean);
  const normVerbKws = TAKING_VERB_KW
    .map(k => normalizeForKwMatch(k).split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean))
    .filter(kts => kts.length > 0);
  let foundTakingVerb = false;
  for (let i = 0; i < tokens.length; i++) {
    const isVerb = normVerbKws.some(kts =>
      kts.length === 1
        ? tokenMatchesKw(tokens[i], kts[0])
        : kts.every((kt, j) => i + j < tokens.length && tokenMatchesKw(tokens[i + j], kt))
    );
    if (!isVerb) continue;
    const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (nextTok !== null && ARREST_POSTFIX.has(nextTok)) continue;
    foundTakingVerb = true;
    break;
  }
  if (!foundTakingVerb) return false;
  return factsMatchKeywords(facts, MONEY_NOUN_KW);
}

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
   T.PROX, "انه→CM, يعمل=filler, ضابطاً startsWith ضابط"],

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
   T.BOTH, "prox fires; قبض not followed by على; مبلغاً startsWith مبلغ → BOTH"],

  // Row 16: قبض على = arrest
  ["ادعى أنه ضابط، وقبضت عليه الشرطة وبحوزته مبلغ",
   T.PROX, "prox fires; وقبضت followed by عليه → taking verb excluded → PROX only (no override)"],
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
    const toks = normalizeForKwMatch(text).split(/[^؀-ۿa-zA-Z0-9]+/).filter(Boolean);
    console.log(`  GOT: prox=${prox} money=${money}`);
    console.log(`  tokens: ${JSON.stringify(toks)}`);
  }
}
console.log("─".repeat(76));
console.log(allOk ? "ALL PASSED" : "FAILURES — see above");
process.exit(allOk ? 0 : 1);
