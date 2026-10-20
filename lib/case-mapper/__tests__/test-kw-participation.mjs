// factsMatchParticipation verification (Commit 39)
import { factsMatchParticipation } from "../kw-matcher.mjs";

// B12-05 verbatim
const B12_05 =
  "المشتكي قال إن اتنين زول سطوا على محله بالتهديد وأخذوا كل الكاش، واحد منهم وقف على الباب والتاني أمسكه من تيشيرته وطالبه بالفلوس.";

// [text, expected, note]
const tests = [
  // ── POSITIVES ─────────────────────────────────────────────────────────────
  [B12_05,
    true,  "PA1  B12-05 verbatim — 'اتنين' single-token fires + واحد/التاني ordered pattern"],
  ["واحد منهم وقف على الباب والتاني دخل المحل",
    true,  "PA2  واحد (first-actor) + والتاني within 12 → ordered pattern fires"],
  ["الجماعة ديل هجموا على المحل بالليل",
    true,  "PA3  الجماعة ديل two-token adjacent pattern → fire"],
  ["قال إن صحابو ساعدوه في تنفيذ الأمر",
    true,  "PA4  صحابو single-token → fire"],
  ["دخلوا المنزل مع آخرين وأحدثوا فوضى",
    true,  "PA5  مع آخرين two-token adjacent → fire"],
  ["اتنين زول ضربوه في الشارع وأخذوا محفظته",
    true,  "PA6  اتنين single-token → fire"],
  ["تحركت العصابة كاملة نحو المنزل ليلاً",
    true,  "PA7  عصابة single-token → fire"],
  ["اشترك مع آخرين في الاستيلاء على المال",
    true,  "PA8  اشترك formal single-token → fire"],
  ["شلة من الحارة هاجموا محله وكسروا الباب",
    true,  "PA9  شلة single-token → fire"],
  ["واحد من المجموعة أمسكه والأول دفعه للأرض",
    true,  "PA10 مجموعة single-token → fire; also واحد+الأول ordered"],

  // ── NEGATIVES ─────────────────────────────────────────────────────────────
  ["واحد دخل المحل وسرق التلفزيون",
    false, "PN1  واحد alone (no second-actor token in window) → guard → no fire"],
  ["سرق بمفرده دون مساعدة أحد",
    false, "PN2  no participation token → no fire"],
  ["اعتدى عليه في الطريق وجرحه",
    false, "PN3  no participation token → no fire"],
  ["دخل منزله وأشعل النار فيه",
    false, "PN4  no participation token → no fire"],
  ["أخذ المال من المحل وفرّ هارباً",
    false, "PN5  no participation token → no fire"],
  ["لم يكن معه أحد حسب الشهود",
    false, "PN6  no participation token; معه alone without آخرين/زول → no fire"],
  ["الواحد ما يقدر يعمل كده لوحده",
    false, "PN7  واحد alone without second-actor → guard → no fire"],
  ["ضربه في غياب أي شهود",
    false, "PN8  no participation token → no fire"],
];

function runSuite(tests, fn) {
  let allPassed = true;
  console.log("\nfactsMatchParticipation\n" + "─".repeat(80));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "YES     " : "NO      "}] got=${got}  "${text.slice(0, 60)}"  (${note})`);
  }
  console.log("─".repeat(80));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const passed = runSuite(tests, factsMatchParticipation);
process.exit(passed ? 0 : 1);
