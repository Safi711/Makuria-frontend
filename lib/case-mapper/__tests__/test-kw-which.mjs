// Section C — whichLethalMethod label/null verification.
import { whichLethalMethod } from "../kw-matcher.mjs";

// [text, expected_label_or_null, note]
const tests = [
  // ── Returns method label ────────────────────────────────────────────────────
  ["خنق الجاني ضحيته حتى فقدت وعيها.",                "خنق",   "خنق group → label خنق"],
  ["وضع السم في كأسها.",                               "سم",    "السم → label سم"],
  ["سقاه سماً في طعامه.",                              "سم",    "سماً → label سم"],
  ["سمّم الجاني الطعام.",                               "سم",    "سمّم → label سم"],
  ["أحرق منزله وهو نائم فيه.",                          "حرق",   "أحرق → label حرق"],
  ["سكب البنزين على ملابسه وأشعل فيها النار.",           "حرق",   "سكب البنزين → label حرق"],
  ["أغرق الجاني الطفل في النهر.",                       "إغراق", "أغرق → label إغراق"],
  ["ذبح الجاني المجني عليه بسكين.",                     "ذبح",   "ذبح → label ذبح"],
  ["نحر الجاني ضحيته.",                                 "ذبح",   "نحر → label ذبح"],
  ["وضعت مادة سامة في كوب العصير.",                      "سم",    "مادة سامة → label سم"],
  ["أثبت التحليل وجود المادة السامة في العينة.",         "سم",    "المادة السامة (definite) → label سم"],
  // ── Returns null (no lethal method) ────────────────────────────────────────
  ["ضربه بعصا على رأسه.",                               null,    "stick — no lethal method"],
  ["طعنه بسكين في بطنه.",                               null,    "stab — طعن is weapon not method"],
  ["لكمه في وجهه.",                                     null,    "punch — no lethal method"],
  ["أطلق عليه النار.",                                  null,    "shooting — weapon not method group"],
  // ── Poison proximity — S rows (STRONG: whichLethalMethod = "سم") ────────────
  ["وضعت المرأة مادة سامة مخصصة لمكافحة القوارض داخل كوب عصير قدمته لقريبتها", "سم", "S1 مادة سامة near كوب عصير"],
  ["وضع مادة سامة في الطعام",                                                    "سم", "S2 مادة سامة near طعام"],
  ["خلط مادة سامة بالمشروب",                                                     "سم", "S3 مادة سامة near مشروب"],
  ["دس مادة ضارة في الشراب",                                                     "سم", "S4 مادة ضارة near شراب"],
  ["قدم له شرابًا يحتوي على مادة سامة",                                          "سم", "S5 مادة سامة near شراب"],
  ["حط ليه سم في الأكل",                                                         "سم", "S6 bare سم near أكل"],
  ["خلط ليه مبيد في الشاي",                                                       "سم", "S7 مبيد near شاي"],
  ["سقاه حاجة مسمومة",                                                           "سم", "S8 مسمومة near سقاه"],
  ["وضع له سم فئران في العصير",                                                   "سم", "S9 bare سم near عصير"],
  // ── Poison proximity — N rows (must return null) ──────────────────────────────
  ["دس ليه حاجة في العصير",                                                      null, "N1 no named poison"],
  ["رش مبيداً حشرياً في مزرعة جاره فأتلف المحصول",                               null, "N2 مبيد far from food"],
  ["أحدث به جرحاً قطعياً طوله 3 سم ثم جلسا لتناول الطعام",                       null, "N3 3 سم (measure) excluded"],
  ["قدم سامي الطعام لضيوفه ثم صفع أحدهم",                                        null, "N4 سامي (name) not poison"],
  ["عثر بحوزته على مبيد زراعي ومادة كيميائية سامة",                               null, "N5 مبيد+سامة but no food word"],
  // ── Burning proximity — H rows (STRONG: whichLethalMethod = "حرق") ───────────
  ["أضرم النار في ملابسه",                                                         "حرق", "H1 أضرم near ملابسه"],
  ["أشعل النار في جسده",                                                           "حرق", "H2 أشعل near جسده"],
  ["سكب عليه مادة قابلة للاشتعال وأشعلها",                                        "حرق", "H3 WEAK pour + ignite → STRONG"],
  ["تعمد إحراق المجني عليه",                                                       "حرق", "H4 إحراق within 2 of المجني"],
  ["صب عليه بنزين وولّع فيه",                                                      "حرق", "H5 WEAK pour + ignite → STRONG"],
  ["ولّع في هدومه",                                                                 "حرق", "H6 ولّع near هدومه"],
  ["حرقه بالنار",                                                                  "حرق", "H7 حرقه pronoun suffix"],
  // ── Burning proximity — W1 (WEAK: whichLethalMethod = "حرق") ─────────────────
  ["كب عليه جاز",                                                                  "حرق", "W1 WEAK pour+fuel → label حرق"],
  // ── Burning proximity — N rows (must return null) ─────────────────────────────
  ["أضرم النار في المتجر ليلاً",                                                    null, "N6 ignite but no person target"],
  ["أشعل النار في محصول جاره",                                                      null, "N7 ignite but no person target"],
  ["نُقل للمستشفى مصابًا بحروق إثر انفجار أنبوبة غاز",                             null, "N8 result-only, no act"],
  ["اشتعلت ملابسه أثناء الطبخ",                                                    null, "N9 passive ignition, no act"],
  ["صب عليه الماء البارد",                                                          null, "N10 pour+عليه but water not fuel"],
  // ── Drowning proximity — D rows (STRONG: whichLethalMethod = "إغراق") ─────────────
  ["غمر رأسه تحت الماء",                       "إغراق", "D1 غمر within 2 of رأسه"],
  ["أمسك به ومنعه من الخروج من الماء",          "إغراق", "D2 منعه → الخروج → الماء"],
  ["أبقاه مغمورًا بالماء",                      "إغراق", "D3 مغمور within 2 of الماء"],
  ["غطّسه في الموية",                           "إغراق", "D4 غطّسه pronoun suffix"],
  ["مسك راسه تحت الموية",                       "إغراق", "D5 hold verb → تحت → water"],
  ["غرقه بالقوة",                               "إغراق", "D6 غرقه pronoun suffix"],
  ["غطس راسه في الموية",                        "إغراق", "D7 غطس within 2 of راسه"],
  ["مسكه جوة الموية",                           "إغراق", "D8 hold verb → جوة → water"],
  ["ما خلاه يطلع من الموية",                    "إغراق", "D9 ما خلاه → يطلع → water"],
  // ── Drowning proximity — W rows (WEAK: whichLethalMethod = "إغراق") ──────────────
  ["دفعه عمدًا إلى النهر",                      "إغراق", "W2 WEAK push → label إغراق"],
  ["كباه في البحر",                              "إغراق", "W3 WEAK push → label إغراق"],
  ["دفعه في الترعة",                             "إغراق", "W4 WEAK push → label إغراق"],
  ["كباه في النيل",                              "إغراق", "W5 WEAK push → label إغراق"],
  // ── Drowning proximity — N rows (must return null) ────────────────────────────────
  ["غرق الطفل في النيل أثناء السباحة",          null,    "N11 bare غرق → null"],
  ["كب الموية على الأرض فانزلق جاره",           null,    "N13 كب alone (no pronoun) → null"],
  ["سقط في البئر أثناء العمل",                  null,    "N14 accident → null"],
  ["دفعه فسقط على الأرض",                       null,    "N15 push but no water body → null"],
  // ── Poison exact accusative forms — P rows ────────────────────────────────────
  ["أطعمه طعاماً مسموماً",   "سم",    "P1 مسموماً accusative → label سم"],
  ["قدم له شراباً ساماً",    "سم",    "P2 ساماً accusative → label سم"],
  // ── Conjunction prefix — C rows ───────────────────────────────────────────────
  ["أمسك به وخنقه حتى أغمي عليه",   "خنق",   "C1 وخنقه → خنق"],
  ["تشاجرا فخنقه بيديه",            "خنق",   "C2 فخنقه → خنق"],
  ["أمسك به وأغرقه في النهر",        "إغراق", "C3 وأغرقه → إغراق"],
  ["طرحه أرضاً وذبحه",               "ذبح",   "C4 وذبحه → ذبح"],
  ["ضربه وحرقه بالنار",              "حرق",   "C5 وحرقه → حرق"],
  ["أمسك به وغطّسه في الموية",       "إغراق", "C6 وغطّسه → إغراق"],
  ["فرشه على الأرض ونام",            null,    "C7 فرشه is pour, no ignite → null"],
  // ── N12 and G1-G11 guard rows (must return null) ──────────────────────────────
  ["أُنقذ من الغرق بعد انقلاب المركب",                             null,    "N12 rescue, no act → null"],
  ["اختلفا على فاتورة الماء فدفعه على الأرض",                       null,    "G1 على not prep → null"],
  ["أمسك الخرطوم ورش الماء داخل الحوش ثم ضرب جاره",                null,    "G2 hold+water but no person → null"],
  ["منعه من الخروج وقطع عنه الماء ثم ضربه",                         null,    "G3 منعه→exit but من not immediately → null"],
  ["وجد زرعه مغموراً بالمياه فضرب جاره",                            null,    "G4 مغمور but no anchor → null"],
  ["غطسنا في النيل للسباحة ثم تشاجرنا فضربني",                      null,    "G5 غطسنا no رأسه → null"],
  ["غرقنا في الديون فضربه الدائن",                                   null,    "G6 figurative → null"],
  ["حرقنا النفايات فتشاجر معنا وضربني",                             null,    "G7 burning trash → null"],
  ["كان يحمل جردل الموية فدفعه جاره فسقط",                          null,    "G8 push no prep+water → null"],
  ["رماه بحجر قرب البئر",                                            null,    "G9 throw no prep+water → null"],
  ["أشعل سيجارة ونفخ الدخان فيه ثم صفعه",                          null,    "G10 أشعل but no fire toward person → null"],
  ["وضع له الطعام ثم سمّاه كلباً",                                   null,    "G11 سمّاه not poison → null"],
];

let allPassed = true;
console.log("whichLethalMethod label/null\n" + "─".repeat(72));
for (const [text, expected, note] of tests) {
  const got = whichLethalMethod(text);
  const ok  = got === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} expected=${JSON.stringify(expected)} got=${JSON.stringify(got)}  "${text}"  (${note})`);
}
console.log("─".repeat(72));
console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
process.exit(allPassed ? 0 : 1);
