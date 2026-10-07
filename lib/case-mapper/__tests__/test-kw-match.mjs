// Commit 1 / Commit 4 — factsMatchKeywords fire/no-fire verification.
// Uses real functions from kw-matcher.mjs (no inline copies).
import {
  factsMatchKeywords,
  factsMatchLethalWeapon,
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
  // ── LETHAL_WEAPON_KW — lawyer additions ────────────────────────────────────
  // Must fire
  ["طعنه بسكين",                   "LETHAL", true,  "طعن+ه (pronoun); بسكين → ب+سكين"],
  ["طعنه بسكينة",                  "LETHAL", true,  "بسكينه → ب+سكينه (سكينة→سكينه)"],
  ["ضربه بالساطور",                 "LETHAL", true,  "بالساطور → strip بال → ساطور"],
  ["طعنه بحربة",                    "LETHAL", true,  "طعن+ه; بحربه → ب+حربه"],
  ["رماه بنشاب",                    "LETHAL", true,  "بنشاب → ب+نشاب"],
  ["أخرج مطوة قرن الغزال",          "LETHAL", true,  "مطوة→مطوه exact match"],
  // Must NOT fire
  ["ضرب سيف جاره",                  "LETHAL", false, "سيف bare = personal name; bسيف/بالسيف/السيف/سيفاً accepted"],
  ["جريمة الحرابة",                 "LETHAL", false, "الحرابة strips to حرابه ≠ حربه (banditry, different root)"],
  ["ركب البوكس",                    "LETHAL", false, "بوكس excluded: blunt object"],
  ["ضربه بعصا على رأسه",            "LETHAL", false, "عصا excluded: blunt stick"],
  ["ضربه بسفروق",                   "LETHAL", false, "سفروق excluded: blunt stick"],
  // ── PUBLIC_OFFICIAL_KW — new full-phrase entries ────────────────────────────
  ["اعتقله عناصر أمن الدولة",       "PUBLIC_OFFICIAL", true,  "أمن الدولة 2-token phrase match"],
  ["ضابط في الاستخبارات العسكرية",  "PUBLIC_OFFICIAL", true,  "الاستخبارات العسكرية phrase match"],
  ["حارس أمن مسلح",                 "PUBLIC_OFFICIAL", false, "bare أمن = private guard; not a state official"],
  // ── LETHAL_WEAPON_KW — Commit 6 additions ──────────────────────────────────
  // Must fire
  ["أصابه بطبنجة",                                      "LETHAL", true,  "طبنجة → طبنجه, single-char ب"],
  ["أطلق عليه النار من كلاشينكوف",                     "LETHAL", true,  "phrase أطلق عليه النار; token كلاشينكوف"],
  ["أصيب بعيار ناري",                                   "LETHAL", true,  "phrase عيار ناري, بعيار via single-char ب"],
  ["طعنة سكين في البطن",                                "LETHAL", true,  "طعنة→طعنه exact; factsMatchLethalWeapon withoutVerb fires"],
  ["طعن المتهم المجني عليه في صدره",                   "LETHAL", true,  "طعن fires; next-3 tokens not legal-appeal terms"],
  // Must NOT fire
  ["طعن المتهم في الحكم أمام محكمة الاستئناف",         "LETHAL", false, "طعن + الحكم within 3 tokens → legal appeal"],
  ["قدم محاميه الطعن في القرار",                       "LETHAL", false, "الطعن + القرار within 3 tokens → legal appeal"],
  ["اندلعت النار في المخزن",                           "LETHAL", false, "النار alone; no إطلاق/عيار/طلق → no match"],
];

// LETHAL uses factsMatchLethalWeapon (includes legal-appeal exclusion for طعن).
const matchFn = {
  PUBLIC_OFFICIAL: (t) => factsMatchKeywords(t, PUBLIC_OFFICIAL_KW),
  SUPPLY:          (t) => factsMatchKeywords(t, SUPPLY_TO_PERSON_KW),
  LETHAL:          (t) => factsMatchLethalWeapon(t),
};

let allPassed = true;
console.log("Fire/no-fire verification\n" + "─".repeat(72));
for (const [text, list, expected, note] of tests) {
  const got = matchFn[list](text);
  const ok  = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} [${expected ? "FIRE    " : "NO FIRE "}] expected=${expected} got=${got}  "${text}"  (${note})`);
}
console.log("─".repeat(72));
console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
process.exit(allPassed ? 0 : 1);
