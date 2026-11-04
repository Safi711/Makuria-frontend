import fs from "fs";
import { factsMatchWeaponPublicPlace as wp, factsMatchRobberyDangerousBlow as blow, factsMatchParticipation as part } from "../kw-matcher.mjs";
const b = JSON.parse(fs.readFileSync("lib/case-mapper/__tests__/batch11.json", "utf8")).find((x) => x.id === "B11-10").facts;
const cases = [
  ["B11-10 hiraba", wp(b), true], ["B11-10 attempt", blow(b), true], ["B11-10 participation", part(b), true],
  ["weapon, private place", wp("ضربه بعصا حديدية في البيت."), false],
  ["means of, not a road", wp("أخذ المال عن طريق سكين."), false],
  ["blow to the leg", blow("ضربه بعصا حديدية على ساقه وأخذ حقيبته."), false],
  ["head, no weapon", blow("ضربه بيده على رأسه وأخذ حقيبته."), false],
  ["knife to the chest", blow("طعنه بسكين في صدره وأخذ محفظته."), true],
  ["count of victims only", part("نهب رجل ثلاثة أشخاص في الشارع."), false],
];
let bad = 0;
for (const [n, got, want] of cases) { const ok = got === want; if (!ok) bad++; console.log(`${ok ? "✓" : "✗"} ${n}`); }
console.log(`${cases.length - bad}/${cases.length} passed`);
process.exit(bad ? 1 : 0);
