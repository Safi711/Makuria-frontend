// Commit 14 — factsMatchLethalMethod: lethal-method gate.
// Run with: node lib/case-mapper/__tests__/test-kw-method.mjs
import { factsMatchLethalMethod } from "../kw-matcher.mjs";

const tests = [
  // ── FIRE: lethal method present ────────────────────────────────────────────
  { input: "خنق المتهم زوجته حتى فارقت الحياة.",                            expected: true,  note: "خنق exact" },
  { input: "خنقه بحبل حتى مات.",                                             expected: true,  note: "خنقه — خنق+ه suffix" },
  { input: "وضع المتهم السم في طعام المجني عليه فتوفي.",                     expected: true,  note: "السم — definite article" },
  { input: "دسّ السم في شرابه.",                                              expected: true,  note: "دسّ السم — two-token phrase" },
  { input: "سمّم المتهم المجني عليه.",                                       expected: true,  note: "سمّم (normalized: سمم)" },
  { input: "أفضى إلى وفاته بعد تسميمه.",                                     expected: true,  note: "تسميم masdar" },
  { input: "أحرق المتهم المجني عليه.",                                       expected: true,  note: "أحرق — حرق+ه via suffix" },
  { input: "سكب المتهم البنزين على المجني عليه وأشعل فيه النار فمات.",       expected: true,  note: "أشعل فيه النار — 3-token phrase (البنزين alone no longer fires)" },
  { input: "أغرق الطفل في النهر متعمداً.",                                   expected: true,  note: "أغرق — intentional drowning" },
  { input: "ذبح المتهم المجني عليه بسكين.",                                  expected: true,  note: "ذبح exact" },
  { input: "نحره أمام منزله.",                                               expected: true,  note: "نحر — نحر+ه suffix" },
  // ── NO-FIRE: accidental or unrelated context, and bare-fuel fix (Commit 16) ──
  { input: "تشاجرا في محطة البنزين فضربه بعصا على رأسه فتوفي.",              expected: false, note: "محطة البنزين — fuel-station context, no lethal method" },
  { input: "غرق الطفل في الترعة أثناء غياب والده.",                          expected: false, note: "غرق — accident, not أغرق" },
  { input: "ضرب المتهم المجني عليه بعصا على رأسه فتوفي بعد يومين.",          expected: false, note: "stick — no lethal method keyword" },
  { input: "لكم المتهم المجني عليه فسقط وتوفي.",                             expected: false, note: "punch — no lethal method keyword" },
  // NOTE: factsMatchLethalMethod("أحرق المتهم محصول جاره") returns TRUE —
  // أحرق is in LETHAL_METHOD_KW. The gate doesn't open for that fact set
  // because the LLM classifies it as arson (not قتل عمد/شبه عمد), so the
  // first gate condition fails. Test here reflects keyword function behavior.
  { input: "كتب اسمه على الورقة.",                                           expected: false, note: "اسم — name, not سم" },
  // ── مادة سامة: B11-07 fix ────────────────────────────────────────────────
  { input: "وضعت مادة سامة داخل كوب العصير.",                              expected: true,  note: "مادة سامة — two-token phrase" },
  { input: "أثبت التحليل وجود المادة السامة في بقايا العصير.",              expected: true,  note: "المادة السامة — definite article on both tokens" },
  { input: "عثر على عبوة المادة داخل غرفتها.",                             expected: false, note: "المادة alone (no سامة) — not a lethal method" },
  // ── Poison proximity — S rows (STRONG: factsMatchLethalMethod = true) ────────
  { input: "وضعت المرأة مادة سامة مخصصة لمكافحة القوارض داخل كوب عصير قدمته لقريبتها", expected: true,  note: "S1 مادة سامة near كوب عصير" },
  { input: "وضع مادة سامة في الطعام",                                               expected: true,  note: "S2 مادة سامة near طعام" },
  { input: "خلط مادة سامة بالمشروب",                                                expected: true,  note: "S3 مادة سامة near مشروب" },
  { input: "دس مادة ضارة في الشراب",                                                expected: true,  note: "S4 مادة ضارة near شراب" },
  { input: "قدم له شرابًا يحتوي على مادة سامة",                                     expected: true,  note: "S5 مادة سامة near شراب" },
  { input: "حط ليه سم في الأكل",                                                    expected: true,  note: "S6 bare سم near أكل" },
  { input: "خلط ليه مبيد في الشاي",                                                  expected: true,  note: "S7 مبيد near شاي" },
  { input: "سقاه حاجة مسمومة",                                                      expected: true,  note: "S8 مسمومة near سقاه" },
  { input: "وضع له سم فئران في العصير",                                              expected: true,  note: "S9 bare سم near عصير" },
  // ── Poison proximity — N rows (must not fire) ─────────────────────────────────
  { input: "دس ليه حاجة في العصير",                                                 expected: false, note: "N1 no named poison" },
  { input: "رش مبيداً حشرياً في مزرعة جاره فأتلف المحصول",                          expected: false, note: "N2 مبيد far from food" },
  { input: "أحدث به جرحاً قطعياً طوله 3 سم ثم جلسا لتناول الطعام",                  expected: false, note: "N3 3 سم (measure) excluded" },
  { input: "قدم سامي الطعام لضيوفه ثم صفع أحدهم",                                   expected: false, note: "N4 سامي (name) not poison" },
  { input: "عثر بحوزته على مبيد زراعي ومادة كيميائية سامة",                          expected: false, note: "N5 مبيد+سامة but no food word" },
  // ── Burning proximity — H rows (STRONG: factsMatchLethalMethod = true) ────────
  { input: "أضرم النار في ملابسه",                                                  expected: true,  note: "H1 أضرم near ملابسه" },
  { input: "أشعل النار في جسده",                                                    expected: true,  note: "H2 أشعل near جسده" },
  { input: "سكب عليه مادة قابلة للاشتعال وأشعلها",                                 expected: true,  note: "H3 WEAK pour + ignite → STRONG" },
  { input: "تعمد إحراق المجني عليه",                                                expected: true,  note: "H4 إحراق within 2 of المجني" },
  { input: "صب عليه بنزين وولّع فيه",                                               expected: true,  note: "H5 WEAK pour + ignite → STRONG" },
  { input: "ولّع في هدومه",                                                          expected: true,  note: "H6 ولّع near هدومه" },
  { input: "حرقه بالنار",                                                           expected: true,  note: "H7 حرقه pronoun suffix" },
  // ── Burning proximity — W1 (WEAK: factsMatchLethalMethod = false) ─────────────
  { input: "كب عليه جاز",                                                           expected: false, note: "W1 WEAK pour+fuel, no ignite → false" },
  // ── Burning proximity — N rows (must not fire) ────────────────────────────────
  { input: "أضرم النار في المتجر ليلاً",                                             expected: false, note: "N6 ignite but no person target" },
  { input: "أشعل النار في محصول جاره",                                               expected: false, note: "N7 ignite but no person target" },
  { input: "نُقل للمستشفى مصابًا بحروق إثر انفجار أنبوبة غاز",                      expected: false, note: "N8 result-only, no act" },
  { input: "اشتعلت ملابسه أثناء الطبخ",                                              expected: false, note: "N9 passive ignition, no act" },
  { input: "صب عليه الماء البارد",                                                   expected: false, note: "N10 pour+عليه but water not fuel" },
  // ── Drowning proximity — D rows (STRONG: factsMatchLethalMethod = true) ─────────
  { input: "غمر رأسه تحت الماء",                       expected: true,  note: "D1 غمر within 2 of رأسه" },
  { input: "أمسك به ومنعه من الخروج من الماء",          expected: true,  note: "D2 منعه → الخروج → الماء" },
  { input: "أبقاه مغمورًا بالماء",                      expected: true,  note: "D3 مغمور within 2 of الماء" },
  { input: "غطّسه في الموية",                           expected: true,  note: "D4 غطّسه pronoun suffix" },
  { input: "مسك راسه تحت الموية",                       expected: true,  note: "D5 hold verb → تحت → water" },
  { input: "غرقه بالقوة",                               expected: true,  note: "D6 غرقه pronoun suffix" },
  { input: "غطس راسه في الموية",                        expected: true,  note: "D7 غطس within 2 of راسه" },
  { input: "مسكه جوة الموية",                           expected: true,  note: "D8 hold verb → جوة → water" },
  { input: "ما خلاه يطلع من الموية",                    expected: true,  note: "D9 ما خلاه → يطلع → water" },
  // ── Drowning proximity — W rows (WEAK: factsMatchLethalMethod = false) ────────────
  { input: "دفعه عمدًا إلى النهر",                      expected: false, note: "W2 WEAK push+water body → false" },
  { input: "كباه في البحر",                              expected: false, note: "W3 WEAK push+water body → false" },
  { input: "دفعه في الترعة",                             expected: false, note: "W4 WEAK push+water body → false" },
  { input: "كباه في النيل",                              expected: false, note: "W5 WEAK push+water body → false" },
  // ── Drowning proximity — N rows (must not fire) ───────────────────────────────────
  { input: "غرق الطفل في النيل أثناء السباحة",          expected: false, note: "N11 bare غرق (intransitive) → null" },
  { input: "كب الموية على الأرض فانزلق جاره",            expected: false, note: "N13 كب alone (no pronoun) → null" },
  { input: "سقط في البئر أثناء العمل",                  expected: false, note: "N14 accident, no act → null" },
  { input: "دفعه فسقط على الأرض",                       expected: false, note: "N15 push but no water body → null" },
  // ── Poison exact accusative forms — P rows ────────────────────────────────────
  { input: "أطعمه طعاماً مسموماً",                                    expected: true,  note: "P1 مسموماً accusative near أطعمه → true" },
  { input: "قدم له شراباً ساماً",                                     expected: true,  note: "P2 ساماً accusative near شراباً → true" },
  // ── N12 and G1-G11 guard rows (must not fire) ─────────────────────────────────
  { input: "أُنقذ من الغرق بعد انقلاب المركب",                             expected: false, note: "N12 rescue from drowning, no criminal act → false" },
  { input: "اختلفا على فاتورة الماء فدفعه على الأرض",                       expected: false, note: "G1 push but على not in prep list → false" },
  { input: "أمسك الخرطوم ورش الماء داخل الحوش ثم ضرب جاره",                expected: false, note: "G2 hold+water but no person under water → false" },
  { input: "منعه من الخروج وقطع عنه الماء ثم ضربه",                         expected: false, note: "G3 منعه→الخروج but من not immediately after exit → false" },
  { input: "وجد زرعه مغموراً بالمياه فضرب جاره",                            expected: false, note: "G4 مغمور+water but no anchor before → false" },
  { input: "غطسنا في النيل للسباحة ثم تشاجرنا فضربني",                      expected: false, note: "G5 غطسنا plural, no رأسه nearby → false" },
  { input: "غرقنا في الديون فضربه الدائن",                                   expected: false, note: "G6 figurative غرقنا → false" },
  { input: "حرقنا النفايات فتشاجر معنا وضربني",                             expected: false, note: "G7 burning trash not person → false" },
  { input: "كان يحمل جردل الموية فدفعه جاره فسقط",                          expected: false, note: "G8 push but no prep+water body immediately → false" },
  { input: "رماه بحجر قرب البئر",                                            expected: false, note: "G9 throw but no prep+water body immediately → false" },
  { input: "أشعل سيجارة ونفخ الدخان فيه ثم صفعه",                          expected: false, note: "G10 أشعل but no النار toward person → false" },
  { input: "وضع له الطعام ثم سمّاه كلباً",                                   expected: false, note: "G11 سمّاه (named him) not poison → false" },
];

let allPassed = true;
console.log("Lethal-method gate — " + tests.length + "-row test\n" + "─".repeat(70));
for (const { input, expected, note } of tests) {
  const got = factsMatchLethalMethod(input);
  const ok = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} ${note}`);
  if (!ok) {
    console.log(`  input:    ${input}`);
    console.log(`  expected: ${expected}`);
    console.log(`  got:      ${got}`);
  }
}
console.log("─".repeat(70));
console.log(allPassed ? "ALL PASSED" : "FAILURES");
process.exit(allPassed ? 0 : 1);
