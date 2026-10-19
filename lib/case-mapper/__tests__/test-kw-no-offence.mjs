// factsMatchPropertyDamage, factsMatchAccidentMarker, factsMatchRescueNecessity
// verification (Commit 38 part 1).
import {
  factsMatchPropertyDamage,
  factsMatchAccidentMarker,
  factsMatchRescueNecessity,
} from "../kw-matcher.mjs";

// ── factsMatchPropertyDamage ──────────────────────────────────────────────────
// [text, expected, note]
const damageTests = [
  // ── POSITIVES ─────────────────────────────────────────────────────────────
  ["ركل الكرة فاصطدمت بزجاج سيارة وكسرته",
    true,  "PD1  كسرته (suffix كسر) + زجاج/سيارة within 3 → fire"],
  ["كسر قفل الباب لإنقاذ الطفل",
    true,  "PD2  كسر + قفل within 3 → fire"],
  ["حطّم الشاشة في لحظة غضب",
    true,  "PD3  حطم + شاشة within 3 → fire"],
  ["خرّب جدار المنزل بمطرقة",
    true,  "PD4  خرب + جدار within 3 → fire"],
  ["أتلف بضاعة المحل كلها",
    true,  "PD5  اتلف + بضاعة within 3 → fire"],
  ["انكسرت زجاجة المطبخ وتناثرت الشظايا",
    true,  "PD6  انكسرت + زجاجة (suffix rule → زجاج) → fire"],
  ["هشّم موبايله في لحظة غضب",
    true,  "PD7  هشم + موبايل within 3 → fire"],
  ["ثقب نافذة الجيران بحجر",
    true,  "PD8  ثقب + نافذة within 3 → fire"],
  ["مزّق الأثاث الجديد أمام الجميع",
    true,  "PD9  مزق + أثاث within 3 → fire"],
  ["تحطّمت واجهة الدكان بالحجارة",
    true,  "PD10 تحطم + الدكان within 3 → fire"],
  // ── NEGATIVES ─────────────────────────────────────────────────────────────
  ["كسر يده في الحادث",
    false, "ND1  كسر but يد (BODY_PART_KW) within 3 → body-part guard → no fire"],
  ["كسر ذراعه أثناء المباراة",
    false, "ND2  كسر but ذراع (BODY_PART_KW) within 3 → body-part guard → no fire"],
  ["ضربه بعصا على ظهره",
    false, "ND3  ضرب not in damage-verb list → no fire"],
  ["لم يكن كسر الباب صحيحاً",
    false, "ND4  لم within 2 before كسر → negation guard → no fire"],
  ["وقعت السيارة في الحفرة",
    false, "ND5  no damage verb, only property noun → no fire"],
  ["لم يكسر شيئاً في المكان",
    false, "ND6  يكسر not in damage-verb list → no fire trivially"],
  ["أصيب بكسر في ذراعه",
    false, "ND7  كسر + ذراع (BODY_PART_KW) within 3 → body-part guard → no fire"],
  ["سمع صوت كسر لكن لم يرَ شيئاً",
    false, "ND8  كسر present but no property noun within 3 → no fire"],
];

// ── factsMatchAccidentMarker ──────────────────────────────────────────────────
const accidentTests = [
  // ── POSITIVES ─────────────────────────────────────────────────────────────
  ["ركل الكرة أثناء مباراة فاصطدمت بزجاج وكسرته",
    true,  "AC1  أثناء + مباراة within 2 → fire"],
  ["حدث ذلك عرضاً دون قصد مسبق",
    true,  "AC2  عرضاً (single token) → fire"],
  ["لم يقصد كسر الباب وإنما أراد إحكامه",
    true,  "AC3  لم + يقصد within 2 → fire"],
  ["كان غير متعمد للإضرار به",
    true,  "AC4  غير + متعمد within 2 → fire"],
  ["انزلق ووقع على السيارة فكسر زجاجها",
    true,  "AC5  انزلق (single token) → fire"],
  ["سقط عليه الباب عرضاً أثناء الإصلاح",
    true,  "AC6  سقط + عليه within 2 → fire"],
  ["أثناء لعبهم كسروا النافذة بالكرة",
    true,  "AC7  أثناء + لعب within 2 → fire"],
  ["حدث بالصدفة ولم يكن متوقعاً",
    true,  "AC8  بالصدفة → strip بال prefix → صدفة → fire"],
  ["ما قصد إيذاءه أصلاً",
    true,  "AC9  ما + قصد → fire"],
  ["ارتدت الرصاصة وأصابته",
    true,  "AC10 ارتدت (single token) → fire"],
  // ── NEGATIVES ─────────────────────────────────────────────────────────────
  ["كسر الباب وسرق التلفزيون",
    false, "NA1  deliberate damage, no accident marker → no fire"],
  ["حطّم الشاشة في لحظة غضب متعمداً",
    false, "NA2  متعمداً alone ≠ غير متعمد → no fire"],
  ["تعمّد تخريب الممتلكات أمام الجيران",
    false, "NA3  no accident-marker token → no fire"],
  ["ضربه عمداً وبإصرار مسبق",
    false, "NA4  no accident-marker token → no fire"],
  ["أثناء هروبه كسر البوابة",
    false, "NA5  أثناء + هروبه — هروب not in PLAY_NORMS → no fire"],
  ["فعله دون تردد وبتخطيط مسبق",
    false, "NA6  دون alone without قصد immediately after (تردد intervenes, distance>2) → no fire"],
  ["قصد إيذاء الضحية من البداية",
    false, "NA7  قصد alone (no دون/لم/ما before it) → no fire"],
  ["أقدم على الفعل بنية واضحة ومتعمداً",
    false, "NA8  no accident-marker token → no fire"],
];

// ── factsMatchRescueNecessity ─────────────────────────────────────────────────
const rescueTests = [
  // ── POSITIVES ─────────────────────────────────────────────────────────────
  ["كسر قفل الباب لإنقاذ الطفل",
    true,  "RS1  لإنقاذ (rule 3 → إنقاذ) within 8 of كسر → fire"],
  ["اقتحم الغرفة لإنقاذ شخص كان يختنق",
    true,  "RS2  يختنق within 8 of اقتحم (entry verb) → fire"],
  ["فتح الباب بالقوة لأن طفلاً وحده داخل",
    true,  "RS3  طفل + وحده within 2; فتح within 8 → fire"],
  ["دخل الدار بعد أن سمع استغاثة من الداخل",
    true,  "RS4  استغاثة (suffix → استغاث) within 8 of دخل → fire"],
  ["كسر النافذة بعد أن رأى النار داخل الغرفة",
    true,  "RS5  نار + داخل within 2; كسر within 8 → fire"],
  ["اقتحم المبنى لإنقاذ شخص مغمى عليه",
    true,  "RS6  مغمى + عليه within 8 of اقتحم → fire"],
  ["حطّم الباب لأن الطفل عالق بالداخل",
    true,  "RS7  عالق within 8 of حطم → fire"],
  ["دخل بعد أن سمع صراخاً شديداً من الداخل",
    true,  "RS8  صراخاً (suffix → صراخ) within 8 of دخل → fire"],
  ["فتح الشباك لأن الطفلة فاقدة الوعي",
    true,  "RS9  فاقد + وعي within 8 of فتح → fire"],
  ["كسر الباب لإنقاذ شخص كان يغرق في المسبح",
    true,  "RS10 يغرق within 8 of كسر → fire"],
  // ── NEGATIVES ─────────────────────────────────────────────────────────────
  ["سمع صراخاً في الشارع ثم ذهب للنوم",
    false, "RN1  صراخ but no damage/entry verb within 8 → no fire"],
  ["كسر الباب وسرق التلفزيون",
    false, "RN2  كسر (damage verb) but no rescue marker → no fire"],
  ["استغاث بالجيران لأن أخته مريضة",
    false, "RN3  استغاث but no damage/entry verb within 8 → no fire"],
  ["دخل المخزن دون إذن",
    false, "RN4  دخل (entry verb) but no rescue marker → no fire"],
  ["أنقذ سمعته من الفضيحة",
    false, "RN5  أنقذ (rescue) but no damage/entry verb within 8 → no fire"],
  ["الخطر كان واضحاً للجميع دون أن يتصرف أحد",
    false, "RN6  خطر but no damage/entry verb within 8 → no fire"],
  ["رأى حريقاً في المبنى وأبلغ الإطفاء",
    false, "RN7  حريق but no داخل within 2 → pattern doesn't fire; no rescue token nearby damage/entry verb → no fire"],
  ["انزلق على الدرج وكسر إصبعه",
    false, "RN8  كسر (damage) + إصبع (BODY_PART_KW) → body-part guard in factsMatchPropertyDamage; no rescue marker anyway → no fire"],
];

function runSuite(name, tests, fn) {
  let allPassed = true;
  console.log(`\n${name}\n` + "─".repeat(72));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "YES     " : "NO      "}] got=${got}  "${text}"  (${note})`);
  }
  console.log("─".repeat(72));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const p1 = runSuite("factsMatchPropertyDamage", damageTests, factsMatchPropertyDamage);
const p2 = runSuite("factsMatchAccidentMarker", accidentTests, factsMatchAccidentMarker);
const p3 = runSuite("factsMatchRescueNecessity", rescueTests, factsMatchRescueNecessity);
process.exit(p1 && p2 && p3 ? 0 : 1);
