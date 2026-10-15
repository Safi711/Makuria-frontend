// Commit 2 — keyword gate verification.
// Uses real functions from kw-matcher.mjs (no inline copies).
import {
  factsMatchKeywords,
  PUBLIC_OFFICIAL_KW,
  LEGAL_PROCEEDING_KW,
  UNIFORM_KW,
} from "../kw-matcher.mjs";

// B10-097 facts
const B10_097 = "أوهم المتهم المجني عليه بأنه موظف في مكتب الأراضي، وقبض منه مبلغاً لاستخراج شهادة بحث، ثم اختفى.";

const tests = [
  // ── PUBLIC_OFFICIAL: must fire ──────────────────────────────────────────
  ["ادعى أنه ضابط",         "PUB", true,  "ضابط exact token"],
  ["بأنه موظف في مكتب",     "PUB", true,  "موظف exact token (B10-097 fragment)"],
  ["تصرف كالمأمور",          "PUB", true,  "مأمور with كال prefix strip"],
  // ── PUBLIC_OFFICIAL: must not fire ──────────────────────────────────────
  ["أخذ المال",             "PUB", false, "no public-official keyword"],
  ["انتحال شخصية",           "PUB", false, "انتحال itself does not trigger public-official"],
  // ── LEGAL_PROCEEDING: must fire ─────────────────────────────────────────
  ["رفع دعوى أمام المحكمة", "LEG", true,  "دعوى + محكمة (multi-keyword)"],
  ["قدّم إقراراً كتابياً",   "LEG", true,  "إقرار"],
  ["وقع ضامناً للمتهم",     "LEG", true,  "ضامن"],
  // ── LEGAL_PROCEEDING: must not fire ─────────────────────────────────────
  ["ادعى أنه ضابط",         "LEG", false, "public-official facts, no legal proceeding"],
  [B10_097,                 "LEG", false, "B10-097 has no legal-proceeding keyword"],
  // ── UNIFORM: must fire ──────────────────────────────────────────────────
  ["ارتدى زياً عسكرياً",    "UNF", true,  "زي عسكري phrase: زياً → زي + suffix ا"],
  ["حمل شارة الشرطة",       "UNF", true,  "شارة الشرطة phrase match"],
  ["يرتدي الزي الرسمي",     "UNF", true,  "الزي الرسمي → strip ال → زي رسمي"],
  // ── UNIFORM: must not fire ──────────────────────────────────────────────
  ["ادعى أنه ضابط",         "UNF", false, "no uniform or badge keyword"],
  ["زي ما قال الشاكي",      "UNF", false, "زي = 'like/as' in colloquial Sudanese"],
  // ── B10-097 gate summary ────────────────────────────────────────────────
  [B10_097, "PUB", true,  "B10-097 → PUBLIC fires → انتحال:موظف → Art. 93 rank 1"],
];

const listFor = { PUB: PUBLIC_OFFICIAL_KW, LEG: LEGAL_PROCEEDING_KW, UNF: UNIFORM_KW };

let allPassed = true;
console.log("Commit 2 — keyword gate verification\n" + "─".repeat(72));
for (const [text, list, expected, note] of tests) {
  const got = factsMatchKeywords(text, listFor[list]);
  const ok  = got === expected;
  if (!ok) allPassed = false;
  const short = text.length > 35 ? text.slice(0, 35) + "…" : text;
  console.log(`${ok ? "✓" : "✗"} [${expected ? "FIRE    " : "NO FIRE "}] ${list.padEnd(3)}  "${short}"  (${note})`);
}
console.log("─".repeat(72));
console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
process.exit(allPassed ? 0 : 1);
