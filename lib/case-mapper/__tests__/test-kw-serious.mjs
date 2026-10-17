// factsMatchSeriousInjury and factsMatchDangerousSite verification.
import { factsMatchSeriousInjury, factsMatchDangerousSite } from "../kw-matcher.mjs";

// ── factsMatchSeriousInjury ───────────────────────────────────────────────────
// [text, expected, note]
const seriousTests = [
  // ── FIRE ────────────────────────────────────────────────────────────────────
  ["ضرب شخصاً بعصا على ساعده وأثبتت الأشعة وجود كسر",
    true,  "SI1  كسر ساعد → bone fracture → fire"],
  ["ضربه على رجله فأصيب بكسر في عظم الساق",
    true,  "SI2  كسر عظم ساق → bone fracture → fire"],
  ["كبّ عليها ماءً مغلياً على جسمها",
    true,  "SI3  ماء مغلي + عليها → hot liquid pour → fire"],
  ["صب ماءً ساخناً على وجهه",
    true,  "SI4  ماء ساخن + وجهه → hot liquid pour → fire"],
  ["رشّ شخص وجه امرأة بموية نار فأصابها بحروق",
    true,  "SI5  موية نار + وجه → caustic liquid pour → fire"],
  ["أدخل شخص ماءً مغلياً في أنف إنسان نائم",
    true,  "SI6  ماء مغلي + أدخل + أنف → fire"],
  // ── NO FIRE ─────────────────────────────────────────────────────────────────
  ["ضرب شخص آخر فأحدث كدمة وألماً دون كسر",
    false, "SI7  ألم + كدمة (no fracture, no hot liquid) → no fire"],
  ["صب عليه الماء البارد",
    false, "SI8  ماء بارد (cold liquid guard) → no fire"],
  ["أشعل النار في الغرفة",
    false, "SI9  ignite alone (no pour + hot liquid) → no fire"],
  ["أصيب بحروق نتيجة انفجار الغاز",
    false, "SI10 burns from explosion (no pour verb) → no fire"],
  ["فاتورة الماء بلغت ألف جنيه",
    false, "SI11 فاتورة الماء (no pour verb near person) → no fire"],
  ["كسر قفل المخزن وأخذ البضاعة",
    false, "SI12 كسر قفل (no body part within ±4) → no fire"],
];

// ── factsMatchDangerousSite ───────────────────────────────────────────────────
const siteTests = [
  // ── FIRE ────────────────────────────────────────────────────────────────────
  ["رشّ شخص وجه امرأة بموية نار فأصابها بحروق",
    true,  "DS1  موية نار + وجه (within 4) → fire"],
  ["صب ماءً مغلياً على عينه",
    true,  "DS2  ماء مغلي + عينه (within 4) → fire"],
  ["كب عليه زيتاً مغلياً في وجهه",
    true,  "DS3  زيت مغلي + وجهه → fire"],
  ["رش حامضاً على أنف المجني عليه",
    true,  "DS4  حامض + أنف → fire"],
  ["سكب موية مغلية على رأسه",
    true,  "DS5  موية مغلية + رأسه → fire"],
  ["رمى في فمه ماءً مغلياً",
    true,  "DS6  ماء مغلي + فمه → fire"],
  // ── NO FIRE ─────────────────────────────────────────────────────────────────
  ["كب عليها موية سخنة في رجلها",
    false, "DS7  موية سخنة + رجلها (leg not in danger-site list) → no fire"],
  ["صب ماءً مغلياً على يده",
    false, "DS8  ماء مغلي + يده (hand not in danger-site list) → no fire"],
  ["صب عليه الماء البارد",
    false, "DS9  ماء بارد (cold liquid) → no fire"],
  ["ضربه على رجله فأصيب بكسر",
    false, "DS10 bone fracture (no hot liquid pour) → no danger-site fire"],
  ["كبّ ماءً مغلياً على الأرض",
    false, "DS11 ماء مغلي + الأرض (no person target → no pour → no fire)"],
  ["شاياً فاتراً على وجهه",
    false, "DS12 شاي فاتر (mild liquid) + وجهه → no fire"],
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

const p1 = runSuite("factsMatchSeriousInjury fire/no-fire", seriousTests, factsMatchSeriousInjury);
const p2 = runSuite("factsMatchDangerousSite fire/no-fire", siteTests, factsMatchDangerousSite);
process.exit(p1 && p2 ? 0 : 1);
