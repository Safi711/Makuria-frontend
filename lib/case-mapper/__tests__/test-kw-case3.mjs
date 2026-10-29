// Case 3 fixes: participation must not fire on "اتشاكل مع زول"; blunt-instrument gate.
import { factsMatchParticipation, factsMatchBluntInstrument, factsStateIntentWords } from "../kw-matcher.mjs";

const tests = [
  // [fn, text, expected, note]
  [factsMatchParticipation, "زول اتشاكل مع زول في الموقف وضربو بعكاز في راسو وانفتح", false, "P1 case 3 — other party, not co-offender"],
  [factsMatchParticipation, "اتشاجر مع زول في السوق وطعنه", false, "P2 تشاجر مع زول"],
  [factsMatchParticipation, "عندو مشكلة مع زول قديمة فضربه", false, "P3 مشكلة مع زول"],
  [factsMatchParticipation, "دخل الدكان مع زول تاني وسرقوا الخزنة", true, "P4 مع زول + theft → companion"],
  [factsMatchParticipation, "جا مع زول وضربوه هو والتاني", true, "P5 جا مع زول → companion"],
  [factsMatchParticipation, "ضربوه اتنين في الموقف", true, "P6 اتنين still fires"],
  [factsMatchBluntInstrument, "ضربو بعكاز في راسو وانفتح", true, "B1 عكاز"],
  [factsMatchBluntInstrument, "ضربه بالعصا على يده", true, "B2 العصا"],
  [factsMatchBluntInstrument, "رماه بحجر فشج رأسه", true, "B3 حجر"],
  [factsMatchBluntInstrument, "ضربه بعصا حديدية في رأسه", false, "B4 iron rod excluded"],
  [factsMatchBluntInstrument, "طعنه بسكين في صدره", false, "B5 knife is not blunt"],
  [factsStateIntentWords, "ضربه بالعكاز متعمد في راسه", true, "I1 متعمد"],
  [factsStateIntentWords, "ضربو بعكاز في راسو وانفتح", false, "I2 no intent words"],
];
let pass = 0, fail = 0;
for (const [fn, text, expected, note] of tests) {
  const got = fn(text);
  if (got === expected) pass++;
  else { fail++; console.log(`FAIL ${note}: expected ${expected}, got ${got} — ${text}`); }
}
console.log(`${pass}/${tests.length} passed`);
if (fail) process.exit(1);
