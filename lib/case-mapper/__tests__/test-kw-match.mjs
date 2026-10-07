// Commit 1 / Commit 4 — factsMatchKeywords fire/no-fire verification.
// Uses real functions from kw-matcher.mjs (no inline copies).
import {
  factsMatchKeywords,
  LETHAL_WEAPON_KW,
  SUPPLY_TO_PERSON_KW,
  PUBLIC_OFFICIAL_KW,
} from "../kw-matcher.mjs";

// Items tested:  [text, keyword_list_name, expected, note]
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
  // ── Four new rows ──────────────────────────────────────────────────────────
  ["قدم نفسه كضابط",            "PUBLIC_OFFICIAL", true,  "كضابط → single-char ك comparison"],
  ["وزعوها على الزبائن",        "SUPPLY",          true,  "وزعوها → وزع + verb-ending و + pronoun ها"],
  ["وزعم المتهم أن المخدرات للتعاطي", "SUPPLY",   false, "وزعم = و+زعم (he claimed), م not in suffix list"],
  ["ذهب في مأمورية",            "PUBLIC_OFFICIAL", false, "مأمورية → مأمور + يه — يه not in suffix list"],
];

const listFor = {
  PUBLIC_OFFICIAL: PUBLIC_OFFICIAL_KW,
  SUPPLY: SUPPLY_TO_PERSON_KW,
  LETHAL: LETHAL_WEAPON_KW,
};

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
