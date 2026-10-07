// Standalone verification of factsMatchKeywords logic — mirrors analyze.ts exactly.

function stripTashkeel(t) { return t.replace(/[ً-ْٰ]/g, ""); }
function normalizeForKwMatch(t) {
  return stripTashkeel(t)
    .replace(/[أإآٱ]/g, "ا") // أإآٱ → ا
    .replace(/ة/g, "ه")                      // ة → ه
    .replace(/ى/g, "ي");                     // ى → ي
}
const KW_ARTICLE_PREFIXES = ["وال","فال","بال","كال","لل","ال"];
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

const LETHAL_WEAPON_KW = [
  "طعن","سكين","خنجر","حربة","شفرة","بسيف","بالسيف","بموس","بالموس",
  "رصاص","رصاصة","مسدس","بندقية","سلاح ناري",
];
const SUPPLY_TO_PERSON_KW = [
  "قدم له","سلم له","أعطاه","أعطى","يعطيه","وزع","يوزع","ناول","يناول",
];
const PUBLIC_OFFICIAL_KW = [
  "موظف","ضابط","مأمور","وزارة","حكومي","حكومة",
];

// Items tested:  [text, keyword_list_name, expected]
const tests = [
  // ── Must fire ──────────────────────────────────────────────────────────────
  ["ادعى أنه ضابط",            "PUBLIC_OFFICIAL", true,  "public-official keyword exact"],
  ["قابل الضابط",              "PUBLIC_OFFICIAL", true,  "ضابط with definite article ال"],
  ["ذهب للضابط",               "PUBLIC_OFFICIAL", true,  "ضابط with لل prefix"],
  ["وزعها على زبائنه",          "SUPPLY",          true,  "وزع with pronoun suffix ها"],
  ["ناوله اللفافة",             "SUPPLY",          true,  "ناول with pronoun suffix ه"],
  // ── Must not fire ──────────────────────────────────────────────────────────
  ["التقاضي",                   "PUBLIC_OFFICIAL", false, "قاضي is only a substring of التقاضي"],
  ["تناول المتهم المخدرات",     "SUPPLY",          false, "ناول is only a suffix inside تناول"],
  ["توزع الأرباح",              "SUPPLY",          false, "وزع is not a prefix of توزع"],
  ["أن يسلم نفسه للشرطة",      "SUPPLY",          false, "bare يسلم dropped; phrase سلم له needs له"],
];

const listFor = { PUBLIC_OFFICIAL: PUBLIC_OFFICIAL_KW, SUPPLY: SUPPLY_TO_PERSON_KW, LETHAL: LETHAL_WEAPON_KW };

let allPassed = true;
console.log("Fire/no-fire verification\n" + "─".repeat(72));
for (const [text, list, expected, note] of tests) {
  const got = factsMatchKeywords(text, listFor[list]);
  const ok  = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} [${expected ? "FIRE    " : "NO FIRE "}] expected=${expected} got=${got}  "${text}"  (${note})`);
}
console.log("─".repeat(72));
console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
process.exit(allPassed ? 0 : 1);
