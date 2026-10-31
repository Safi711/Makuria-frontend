// Case 8 (vehicle + hit-and-run) and case 5 (double sale) detectors.
import { factsMatchHitAndRun, factsMatchDoubleSale, factsMatchVehicle } from "../kw-matcher.mjs";

const tests = [
  [factsMatchVehicle, "سائق ركشة صدم طفلًا وهرب دون إسعافه", true, "V1 ركشة"],
  [factsMatchVehicle, "عربية صدمت زول في الشارع", true, "V2 عربية/صدمت"],
  [factsMatchHitAndRun, "سائق ركشة صدم طفلًا وهرب دون إسعافه", true, "H1 هرب"],
  [factsMatchHitAndRun, "عربية صدمت زول وسواقها وقف وودّاه المستشفى", false, "H2 stopped and helped"],
  [factsMatchDoubleSale, "رجل باع قطعة أرض واحدة لشخصين وأخذ الثمن من الاثنين", true, "S1 case 5"],
  [factsMatchDoubleSale, "باع البيت لزول تاني بعد ما باعو لي", true, "S2 colloquial"],
  [factsMatchDoubleSale, "باع لي عربية فيها عيب خفي", false, "S3 single sale"],
  [factsMatchDoubleSale, "اشترى شقتين من شخصين", false, "S4 buyer side"],
];
let pass = 0, fail = 0;
for (const [fn, text, expected, note] of tests) {
  const got = fn(text);
  if (got === expected) pass++;
  else { fail++; console.log(`FAIL ${note}: expected ${expected}, got ${got} — ${text}`); }
}
console.log(`${pass}/${tests.length} passed`);
if (fail) process.exit(1);
