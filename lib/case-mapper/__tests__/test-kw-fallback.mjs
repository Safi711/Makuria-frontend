// factsMatchDeath and factsMatchFireDamage verification (Commit 36).
import {
  factsMatchDeath,
  factsMatchFireDamage,
} from "../kw-matcher.mjs";

// ── factsMatchDeath ───────────────────────────────────────────────────────────
// [text, expected, note]
const deathTests = [
  // ── FIRE ────────────────────────────────────────────────────────────────────
  ["توفي المجني عليه بعد يومين من الحادثة",
    true,  "D1  توفي → fire"],
  ["عاد إلى منزله ثم مات",
    true,  "D2  مات → fire"],
  ["فوجدوه جثة في الغرفة",
    true,  "D3  جثة → fire"],
  ["بعد انتهاء المشاجرة توفيت في المستشفى",
    true,  "D4  توفيت → fire"],
  ["أعلن أهله عن وفاته",
    true,  "D5  وفاة → fire"],
  ["اتصلوا لإبلاغهم بوفاته",
    true,  "D6  وفاته → fire"],
  ["أُفيد بمقتل شخص في المنطقة",
    true,  "D7  مقتل → fire"],
  ["فارق الحياة متأثراً بجروحه",
    true,  "D8  فارق الحياة → two-token phrase → fire"],
  // ── NO FIRE ─────────────────────────────────────────────────────────────────
  ["ماتت بطارية الموبايل أثناء المكالمة",
    false, "D9  ماتت + موبايل (non-person subject) → no fire"],
  ["ماتت بطارية العربية في الطريق",
    false, "D10 ماتت + بطارية (non-person subject) → no fire"],
  ["يعاني من مرض سابق لم يمت بسببه بعد",
    false, "D11 لم + يمت — لم is not in the death KW list so no fire from يمت; مات not present → no fire"],
  ["كاد يموت من الخوف",
    false, "D12 كاد يموت — يموت not in death KW list → no fire"],
  ["لم تثبت الوفاة بالتقرير الطبي",
    false, "D13 لم + الوفاة → negation guard: لم within 2 before وفاة → no fire"],
  ["لا وفاة ثابتة في الملف",
    false, "D14 لا + وفاة → negation guard → no fire"],
  ["ماتت السيارة في المنتصف فاستأجر أخرى",
    false, "D15 ماتت + سيارة (non-person subject) → no fire"],
  ["ما توفي أحد في الحادثة",
    false, "D16 ما + توفي — ما is negator in DEATH_NEGATORS → no fire"],
];

// ── factsMatchFireDamage ──────────────────────────────────────────────────────
const fireTests = [
  // ── FIRE ────────────────────────────────────────────────────────────────────
  ["اندلع حريق في المخزن وأتى على محتوياته",
    true,  "F1  حريق → direct fire token → fire"],
  ["احترقت السيارة بالكامل",
    true,  "F2  احترقت → direct fire token → fire"],
  ["اشتعلت النيران في المحل التجاري",
    true,  "F3  اشتعلت → direct fire token → fire"],
  ["أحرق الدكان بعد منتصف الليل",
    true,  "F4  أحرق → direct fire token → fire"],
  ["ما شفتو ولّع النار وقت الحريقة",
    true,  "F5  ولّع negated by ما BUT الحريقة stands un-negated → fire"],
  ["اندلع الحريق في ساعة متأخرة",
    true,  "F6  اندلع + الحريق within 2 → fire"],
  ["أضرم النيران في المبنى",
    true,  "F7  أضرم → direct fire token → fire"],
  ["تم تسجيل الحريقة من قِبل الجيران",
    true,  "F8  الحريقة → tokenMatchesKw strips ال → حريقة → fire"],
  // ── NO FIRE ─────────────────────────────────────────────────────────────────
  ["حرق يده بالشاي",
    false, "F9  حرق + يده (body part within 3) → injury guard → no fire"],
  ["حرق ذراعه على الموقد",
    false, "F10 حرق + ذراعه (body part within 3) → injury guard → no fire"],
  ["تشاجرا فتضاربا بالأيدي",
    false, "F11 no fire tokens → no fire"],
  ["صب عليه الماء البارد",
    false, "F12 no fire tokens → no fire"],
  ["ضربه بعصا على رأسه فتوفي",
    false, "F13 no fire tokens → no fire"],
  ["كسر قفل الباب لإنقاذه",
    false, "F14 no fire tokens → no fire"],
  ["ولّع المصباح فأضاء الغرفة",
    false, "F15 ولّع + المصباح — النار does not follow within 2 → no fire"],
  ["شرب شاياً ساخناً فحرق حلقه",
    false, "F16 حرق + حلقه (body part within 3) → injury guard → no fire"],
  // ── Negation guard ──────────────────────────────────────────────────────────
  ["دون حدوث حرق",
    false, "F17 دون (negator within 2) before حرق → no fire"],
  ["لم يحترق الدكان",
    false, "F18 لم (negator within 2) before يحترق — no fire (يحترق not in direct list; also negated)"],
  ["بدون حريق",
    false, "F19 بدون (negator within 2) before حريق → no fire"],
  ["ما ولّع النار",
    false, "F20 ما (negator within 2) before ولّع, no other fire token → no fire"],
];

function runSuite(name, tests, fn) {
  let allPassed = true;
  console.log(`\n${name}\n` + "─".repeat(72));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "FIRE    " : "NO FIRE "}] got=${got}  "${text}"  (${note})`);
  }
  console.log("─".repeat(72));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const p1 = runSuite("factsMatchDeath fire/no-fire", deathTests, factsMatchDeath);
const p2 = runSuite("factsMatchFireDamage fire/no-fire", fireTests, factsMatchFireDamage);
process.exit(p1 && p2 ? 0 : 1);
