// factsMatchWeaponPublicPlace verification (Commit 41)
import { factsMatchWeaponPublicPlace } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── POSITIVES — weapon AND public place ───────────────────────────────────
  ["سطا عليه بمطوة في الشارع وسرق منه محفظته.",
    true,  "WP1  B13-130 pattern — مطوة + الشارع → true"],
  ["هاجمه بسكين في الطريق العام وأخذ منه النقود.",
    true,  "WP2  سكين + الطريق العام (phrase) → true"],
  ["أشهر عليه مسدساً في الموقف وأجبره على تسليم محفظته.",
    true,  "WP3  مسدس + الموقف → true"],
  ["اعترضه بخنجر خارج العمران.",
    true,  "WP4  خنجر + خارج العمران → true"],
  ["سرق منه حافظة نقوده بساطور في السوق.",
    true,  "WP5  ساطور + السوق → true"],
  ["هددهم بالسلاح في الخلاء.",
    true,  "WP6  سلاح + الخلاء → true"],

  // ── NEGATIVES — weapon without public place, or place without weapon ──────
  ["ضربه بمطوة في البيت.",
    false, "WN1  مطوة + البيت (private) → false"],
  ["أشهر عليه مسدساً في المستشفى.",
    false, "WN2  مسدس + المستشفى (not in public-place list) → false"],
  ["تشاجرا في المنزل وأخرج سكيناً.",
    false, "WN3  سكين + منزل (private) → false"],
  ["اعتدى عليه في الشارع بيديه فقط.",
    false, "WN4  الشارع but no weapon token → false"],
  ["أخذ منه ماله في المكتب بالتهديد.",
    false, "WN5  no weapon, no public place → false"],
];

function runSuite(tests, fn) {
  let allPassed = true;
  console.log("\nfactsMatchWeaponPublicPlace\n" + "─".repeat(80));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "YES     " : "NO      "}] got=${got}  "${text.slice(0, 65)}"  (${note})`);
  }
  console.log("─".repeat(80));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const passed = runSuite(tests, factsMatchWeaponPublicPlace);
process.exit(passed ? 0 : 1);
