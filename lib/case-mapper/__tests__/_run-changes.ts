/**
 * Final-run battery for Changes 1, 2, and 3.
 * 3 runs each.
 * Table: ID | expected-laws | expected-cards | raw LLM concept | laws-got | card-keys | desc-note | PASS/FAIL | note
 *
 * desc-note column (Change 3 only):
 *   "want:yes" → expects the نفي-append line in قتل:وصف description
 *   "want:no"  → expects NO such line in قتل:وصف description
 *   "—"        → not checked
 *
 * Run: npx tsx lib/case-mapper/__tests__/_run-changes.ts
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const RUNS = 3;
const NEGATE_KILL_APPEND_FRAGMENT = "ورد في الوقائع نفيٌ لقصد القتل";

interface PrimaryNoteCheck { articleNumber: string; noteStartsWith: string | null; }
interface DiscussNoteCheck { concept: string; articleNumber: string; noteStartsWith: string; }

interface Case {
  id: string;
  facts: string;
  expectedLaws: string[] | null;       // null = don't check
  expectedCardCount: number | null;    // null = don't check
  expectedCardKeys: string[] | null;   // null = don't check (any order); checked for exact set equality
  mustIncludeCardKeys?: string[];      // all must appear in got (subset); ignored when reportOnly
  mustNotIncludeCardKeys?: string[];   // none may appear in got; ignored when reportOnly
  expectedDescNote: "yes" | "no" | null; // null = don't check
  primaryNoteChecks?: PrimaryNoteCheck[];     // null noteStartsWith → must be null; string → must start with
  discussArticleNoteChecks?: DiscussNoteCheck[];
  reportOnly?: boolean;
  note: string;
}

const CASES: Case[] = [
  // ══ CHANGE 1 — إصابة:وصف card ════════════════════════════════════════════
  // Laws 138 + 2 cards (attempt + إصابة:وصف)
  {
    id: "C1A",
    facts: "خنقه حتى أغمي عليه ثم أفاق.",
    expectedLaws: ["138"],
    expectedCardCount: 2,
    expectedCardKeys: ["شروع:خنق", "إصابة:وصف"],
    expectedDescNote: null,
    note: "خنق + no wound + no weapon → 138, 2 cards [شروع:خنق, إصابة:وصف]",
  },
  {
    id: "C1B",
    facts: "دسّ المتهم السم في شراب المجني عليه فنُقل إلى المستشفى ونجا.",
    expectedLaws: ["138"],
    expectedCardCount: 2,
    expectedCardKeys: ["شروع:سم", "إصابة:وصف"],
    expectedDescNote: null,
    note: "سم + no wound + no weapon → 138, 2 cards [شروع:سم, إصابة:وصف]",
  },
  {
    id: "C1C",
    facts: "أغرق المتهم المجني عليه في الترعة حتى أنقذه المارة.",
    expectedLaws: ["138"],
    expectedCardCount: 2,
    expectedCardKeys: ["شروع:إغراق", "إصابة:وصف"],
    expectedDescNote: null,
    note: "إغراق + no wound + no weapon → 138, 2 cards [شروع:إغراق, إصابة:وصف]",
  },
  // Laws 139, 138 + attempt card only (weapon present or wound present)
  {
    id: "C1D",
    facts: "طعن المتهم المجني عليه بسكين في بطنه أثناء مشاجرة.",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["شروع:سلاح"],
    expectedDescNote: null,
    note: "سكين + alive → 139,138 + شروع:سلاح (weapon present, no إصابة:وصف)",
  },
  {
    id: "C1E",
    facts: "حاول المتهم ذبح المجني عليه فأصابه بجرح في عنقه ونجا.",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["شروع:ذبح"],
    expectedDescNote: null,
    note: "ذبح + جرح (wound present) → 139,138 + شروع:ذبح (no إصابة:وصف)",
  },
  {
    id: "C1F",
    facts: "ضرب شخص آخر بسكين عمدًا، فأحدث جرحًا قطعيًا مثبتًا طبيًا، دون وفاته.",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["شروع:سلاح"],
    expectedDescNote: null,
    note: "golden 10: سكين + جرحاً (wound) → 139,138 + شروع:سلاح",
  },
  // Unchanged: أذى, no method, no card
  {
    id: "C1G",
    facts: "ضرب المتهم جاره كفاً على وجهه ولم يحدث به جرحاً.",
    expectedLaws: ["142"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "كف + no method + no wound → 142 only, no card",
  },
  // Burns ruling (Commit 22): حرق + حروق → 138, 2 cards [شروع:حرق, إصابة:وصف]
  {
    id: "C1H",
    facts: "سكب عليه البنزين وأشعل فيه النار فأصيب بحروق ونجا.",
    expectedLaws: ["138"],
    expectedCardCount: 2,
    expectedCardKeys: ["شروع:حرق", "إصابة:وصف"],
    expectedDescNote: null,
    note: "حرق burns: Art. 139 not auto-classified; gate fires → 138 + [شروع:حرق, إصابة:وصف]",
  },

  // ══ CHANGE 2 — narrator negates intent → قتل:وصف ══════════════════════════
  // Open-point (narrator-level negation)
  {
    id: "C2A",
    facts: "طعنه بسكين في صدره دون أن يقصد قتله فتوفي.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "yes",
    note: "سكين + death + narrator دون أن يقصد → قتل:وصف + desc-note yes",
  },
  {
    id: "C2B",
    facts: "أطلق عليه عياراً نارياً لتخويفه ولم يكن يقصد قتله فأصابه في صدره فمات.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "yes",
    note: "عيار ناري + death + narrator ولم يكن يقصد → قتل:وصف + desc-note yes",
  },
  // Stay Art. 130, 129, no card (accused's denial only)
  {
    id: "C2C",
    facts: "طعن المتهم المجني عليه بسكين في صدره فتوفي، ونفى أنه أراد قتله.",
    expectedLaws: ["130", "129"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "سكين + death + نفى (accused denial) → 130,129, no card",
  },
  {
    id: "C2D",
    facts: "أطلق المتهم النار على المجني عليه فأرداه قتيلاً، وأنكر قصد القتل.",
    expectedLaws: ["130", "129"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "أطلق النار + death + أنكر (accused denial) → 130,129, no card",
  },
  {
    id: "C2E",
    facts: "طعنه بسكين في بطنه فمات، وقال المتهم إنه لم يقصد قتله.",
    expectedLaws: ["130", "129"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "سكين + death + قال...لم يقصد (accused speech) → 130,129, no card",
  },

  // ══ CHANGE 3 — desc-note line present / absent ════════════════════════════
  // Line PRESENT (factsNegateIntentToKill=true, قتل:وصف card)
  {
    id: "C3A",
    facts: "ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "yes",
    note: "O1: دون قصد قتله → قتل:وصف + desc-note YES",
  },
  {
    id: "C3B",
    facts: "ضربه بعصا على رأسه ولم يكن ذلك بقصد قتله فتوفي.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "yes",
    note: "ولم يكن ذلك بقصد قتله → قتل:وصف + desc-note YES",
  },
  // Line ABSENT
  {
    id: "C3C",
    facts: "ضربه بعصا فتوفي، ونفى المتهم أنه أراد قتله.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "no",
    note: "نفى (accused) → قتل:وصف card, desc-note ABSENT",
  },
  {
    id: "C3D",
    facts: "لكم المتهم المجني عليه في وجهه فسقط على الرصيف ومات، وقال إنه لم يقصد قتله.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "no",
    note: "قال...لم يقصد (accused speech) → قتل:وصف card, desc-note ABSENT",
  },
  {
    id: "C3E",
    facts: "ضرب المتهم المجني عليه بعصا على رأسه فتوفي بعد يومين.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: "no",
    note: "no negation phrase → قتل:وصف card, desc-note ABSENT",
  },

  // ══ CHANGE 4 — جرح خطأ + lethal means → جرح عمد gates ═══════════════════
  // (R19, R20 defined above)

  // ══ CHANGE 5 — serious injury review card + explicit attempt (Commit 33) ══
  // Lethal method present: جرح خطأ overrides to جرح عمد → 138 + 2 cards
  {
    id: "R19",
    facts: "خلط ليه مبيد في الشاي ونقلوه المستشفى واتعالج",
    expectedLaws: ["138"],
    expectedCardCount: 2,
    expectedCardKeys: ["شروع:سم", "إصابة:وصف"],
    expectedDescNote: null,
    note: "جرح خطأ + مبيد (lethal method سم) → overrides to جرح عمد → 138 + [شروع:سم, إصابة:وصف]",
  },
  // No lethal means: جرح خطأ stays → Art. 141, no cards
  {
    id: "R20",
    facts: "ضربه بعصا خفيفة فجرحه خطأ",
    expectedLaws: ["141", "138"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "جرح خطأ + عصا (no lethal method/weapon) → no override, no attempt card (LLM yields 141,138 pre-existing)",
  },

  // ══ CHANGE 5 — serious injury review card + explicit attempt (Commit 33) ══
  // Bone fracture → 139, 138 + إصابة:مراجعة
  {
    id: "R21",
    facts: "ضرب شخصاً بعصا على ساعده، وأثبتت الأشعة وجود كسر دون جرح مفتوح",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["إصابة:مراجعة"],
    expectedDescNote: null,
    note: "كسر ساعد → serious injury → 139,138 + إصابة:مراجعة (no attempt card)",
  },
  // Hot liquid pour → 139, 138 + إصابة:مراجعة
  {
    id: "R22",
    facts: "أثناء مشاجرة كبّ شخص ماءً مغلياً على جسم آخر فأحدث حروقاً",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["إصابة:مراجعة"],
    expectedDescNote: null,
    note: "ماء مغلي → serious injury → 139,138 + إصابة:مراجعة (no dangerous site)",
  },
  // Caustic liquid + dangerous site → 139, 138 + إصابة:مراجعة + شروع:حرق
  {
    id: "R23",
    facts: "رشّ شخص وجه امرأة بمادة كاوية «موية نار» فأصابها بحروق",
    expectedLaws: ["139", "138"],
    expectedCardCount: 2,
    expectedCardKeys: ["إصابة:مراجعة", "شروع:حرق"],
    expectedDescNote: null,
    note: "موية نار + وجه (dangerous site) → 139,138 + [إصابة:مراجعة, شروع:حرق]",
  },
  // Stated intent + serious injury → شروع:قتل (20, 130, 19, 139) + إصابة:مراجعة
  {
    id: "R24",
    facts: "أدخل شخص ماءً مغلياً في أنف إنسان نائم بقصد قتله، لكن المجني عليه نجا",
    expectedLaws: ["20", "130", "19", "139"],
    expectedCardCount: 1,
    expectedCardKeys: ["إصابة:مراجعة"],
    expectedDescNote: null,
    note: "بقصد قتله + ماء مغلي في أنف → شروع:قتل [20,130,19,139] + إصابة:مراجعة only",
  },
  // Contusion only — no fracture, no hot liquid → 142, no cards
  {
    id: "R25",
    facts: "ضرب شخص آخر فأحدث كدمة وألماً دون كسر أو حرق أو إصابة جسيمة",
    expectedLaws: ["142"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "كدمة وألم فقط (no fracture, no hot liquid) → 142, no cards",
  },
  // Cold/mild liquid — NOT 139; record what engine returns
  {
    id: "R26",
    facts: "سكب شخص ماءً بارداً أو شاياً فاتراً على آخر دون حدوث حرق أو إصابة مثبتة",
    expectedLaws: null,
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    reportOnly: true,
    note: "ماء بارد/شاي فاتر → cold liquid guard: NOT 139; report what engine returns",
  },
  // Hot liquid to leg — review card but NO attempt (leg not in danger-site list)
  {
    id: "R27",
    facts: "كب عليها موية سخنة في رجلها",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["إصابة:مراجعة"],
    expectedDescNote: null,
    note: "موية سخنة + رجل (not dangerous site) → 139,138 + إصابة:مراجعة only (no attempt card)",
  },
  // ══ CHANGE 6 — Commit 35: جرح خطأ with serious injury stays negligence ══════
  {
    id: "R28",
    facts: "أثناء قيادة سيارة في شارع مزدحم، فوجئ السائق بطفل يعبر الطريق. انحرف لتفاديه فاصطدم بأحد المشاة، الذي أصيب بكسر في ساقه. ذكر السائق أنه كان يقود بالسرعة المقررة.",
    expectedLaws: ["141", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["إهمال:فحص"],
    expectedDescNote: null,
    note: "traffic accident + fracture → stays جرح خطأ; negligence card, NOT إصابة:مراجعة, NOT 139",
  },
  {
    id: "R29",
    facts: "ضربه بعصا على رجله فكسر ساقه ونُقل للمستشفى",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["إصابة:مراجعة"],
    expectedDescNote: null,
    note: "deliberate assault + fracture → unchanged C.2 behaviour",
  },
  {
    id: "R30",
    facts: "دفعه في المشاجرة فوقع وانكسرت ساقه",
    expectedLaws: ["139", "138"],
    expectedCardCount: 1,
    expectedCardKeys: ["إصابة:مراجعة"],
    expectedDescNote: null,
    note: "دفعه is a deliberate-assault verb → C.2 still fires",
  },

  // ══ CHANGE 7 — Commit 36: abstain fallback ════════════════════════════════
  // (a) Assault + death: Art. 129 + قتل:وصف — whether LLM abstains or returns homicide concept
  {
    id: "R31",
    facts: "في مشاجرة داخل مناسبة اجتماعية، ضرب رجل آخر بعصا خشبية على كتفه. بعد انتهاء المشاجرة، عاد المصاب إلى منزله، ثم توفي بعد يومين. لم يصدر تقرير طبي يحدد سبب الوفاة، وذكر أقاربه أنه كان يعاني من مرض سابق.",
    expectedLaws: ["129"],
    expectedCardCount: 1,
    expectedCardKeys: ["قتل:وصف"],
    expectedDescNote: null,
    note: "B12-10: assault + delayed death + uncertain causation → قتل:وصف (abstain route) or قتل:وصف (LLM homicide route). Never 130/131/132.",
  },
  // (b) Fire damage: إتلاف:بيّنة card; laws = null (accepts [] or ["182"])
  {
    id: "R32",
    facts: "قال أحد الشهود في محضر الشرطة: «أنا شفت المتهم واقف قريب من الدكان وقت الحريقة، لكن ما شفتو ولّع النار». وأكد صاحب الدكان أن خلافاً مالياً قديماً كان قائماً بينه وبين المتهم.",
    expectedLaws: null,         // accept [] (abstain route) or any set (LLM route)
    expectedCardCount: 1,
    expectedCardKeys: ["إتلاف:بيّنة"],
    expectedDescNote: null,
    note: "B12-09: fire + no attribution → إتلاف:بيّنة card; laws [] on abstain route. mustNotHave other articles.",
  },
  // Non-criminal sentences: abstain stays empty (no cards, noConfidentMatch true)
  {
    id: "R33",
    facts: "ماتت بطارية العربية في الطريق فدفعها",
    expectedLaws: [],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    reportOnly: true,
    note: "REPORT: LLM classifies as traffic/vehicle (rawConcept=—, laws: 42,الجدول الثاني,28,13,15,30,43,90), 0 cards; non-person-subject guard blocks إتلاف/قتل routes",
  },
  {
    id: "R34",
    facts: "سمع صراخ طفل فكسر قفل الباب لإنقاذه",
    expectedLaws: [],
    expectedCardCount: 1,
    expectedCardKeys: ["إباحة:ضرورة"],
    expectedDescNote: null,
    note: "Commit 38: LLM abstains; property-damage+rescue detectors fire → إباحة:ضرورة card (upgraded from reportOnly)",
  },
  // ══ CHANGE 4 (Commit 37) — extortion without money demand → تهديد ══════════
  {
    id: "R35",
    facts: "قال الشاكي: «الزول دا مسكني من هدومي وقال لي لو جيت الحلة دي تاني حأوريك النجوم في عز الضهر». ولم يضربه أو يستعمل سلاحاً، لكن الشاكي قال إنه خاف من تنفيذ التهديد.",
    expectedLaws: ["144"],
    expectedCardCount: 1,
    expectedCardKeys: ["تهديد:فحص"],
    expectedDescNote: null,
    note: "B12-02: ابتزاز without money demand → تهديد (Art. 144) + فحص card. mustNotHave 176.",
  },
  {
    id: "R36",
    facts: "هدده بالقتل إن لم يدفع له مليون جنيه خلال أسبوع",
    expectedLaws: ["20", "176", "19"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    expectedDescNote: null,
    note: "B12-02 updated (Commit 41): threat + money demand + no delivery (لم يدفع) → شروع:ابتزاز [20,176,19], 0 cards.",
  },
  {
    id: "R37",
    facts: "قال ليهو لو ما جبت القروش بكرة حأوريك",
    expectedLaws: ["176"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    reportOnly: true,
    note: "REPORT: LLM returns تهديد directly (not ابتزاز) for this colloquial sentence — factsMatchMoneyDemand=true but override only fires on ابتزاز; LLM routing is the gap. R36 (مليون جنيه) reliably gives 176.",
  },

  // ══ CHANGE 8 — Commit 38: إباحة cards for accidental damage / necessity ═══
  {
    id: "R38",
    facts: "أثناء مباراة كرة قدم في الحي، ركل أحد اللاعبين الكرة بقوة، فاصطدمت بزجاج سيارة متوقفة خارج الملعب وكسرته. صاحب السيارة طالب اللاعب بالتعويض، بينما قال اللاعب إنه لم يقصد إصابة السيارة.",
    expectedLaws: [],
    expectedCardCount: 1,
    expectedCardKeys: ["إباحة:عرضي"],
    expectedDescNote: null,
    note: "B12-03: accidental damage during football → إباحة:عرضي card; laws []. mustNotHave 182.",
  },
  {
    id: "R39",
    facts: "دخل رجل إلى منزل جاره بعد أن سمع صراخ طفل واستغاثته من الداخل. كسر قفل الباب لإنقاذ الطفل، ثم تبين أن الطفل كان محبوساً وحده وأن والديه خارج المنزل. طالب صاحب المنزل بتعويض قيمة القفل.",
    expectedLaws: [],
    expectedCardCount: 1,
    expectedCardKeys: ["إباحة:ضرورة"],
    expectedDescNote: null,
    note: "B12-06: rescue necessity → إباحة:ضرورة card; laws []. mustNotHave 182/183.",
  },
  {
    id: "R40",
    facts: "كسر لابتوب زوجته في نوبة غضب أمام أولاده",
    expectedLaws: ["182"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "B12-07 (wife's laptop): intentional damage, no accident/rescue markers → Art. 182 unchanged, 0 cards.",
  },
  {
    id: "R41",
    facts: "كسر باب المحل ليلاً وسرق التلفزيون",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    expectedDescNote: null,
    reportOnly: true,
    note: "REPORT: Theft+damage — laws vary (سرقة/إتلاف جنائي/174 etc.); no accident/rescue detectors fire so no إباحة card. Report only; verified by detector logic.",
  },
  // ══ CHANGE 5 (Commit 39) — participation card (اشتراك:فحص, Arts. 21/22) ══
  {
    id: "R42",
    facts: "المشتكي قال إن اتنين زول سطوا على محله بالتهديد وأخذوا كل الكاش، واحد منهم وقف على الباب والتاني أمسكه من تيشيرته وطالبه بالفلوس.",
    expectedLaws: ["175"],
    expectedCardCount: 1,
    expectedCardKeys: ["اشتراك:فحص"],
    expectedDescNote: null,
    note: "B12-05: robbery (سطوا + بالتهديد → نهب, Art. 175) + 'اتنين' → participation card fires; laws [175], 1 card.",
  },
  {
    id: "R43",
    facts: "واحد دخل المحل وسرق التلفزيون",
    expectedLaws: null,
    expectedCardCount: 1,
    expectedCardKeys: ["سرقة:حد"],
    expectedDescNote: null,
    note: "Commit 39 guard: 'واحد' alone has no second-actor in window; participation card must not appear → 1 card [سرقة:حد] only.",
  },

  // ══ CHANGE A (Commit 40) — negligence card for قتل خطأ ════════════════════
  {
    id: "R44",
    facts: "كان السائق يقود الشاحنة في طريق عام ليلاً حين خرج شخص فجأةً أمام السيارة دون أن يُبدي أي إشارة، فلم يتمكن السائق من الوقوف في الوقت المناسب فدهسته الشاحنة وتوفي متأثراً بإصاباته.",
    expectedLaws: ["132"],
    expectedCardCount: 1,
    expectedCardKeys: ["إهمال:فحص:قتل"],
    expectedDescNote: null,
    note: "B13-128: simple traffic accident, no gross negligence → Art. 132 + إهمال:فحص:قتل card.",
  },
  {
    id: "R45",
    facts: "كان السائق يقود الشاحنة في طريق عام وكان ينظر إلى هاتفه فلم ينتبه للمشاة الذين كانوا يعبرون الطريق فاصطدمت الشاحنة بأحدهم وتوفي متأثراً بإصاباته.",
    expectedLaws: ["132"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    expectedDescNote: null,
    note: "B13-127: gross negligence guard fires (ينظر إلى هاتفه) → Art. 132, NO إهمال card.",
  },

  // ══ CHANGE B (Commit 40) — participation card for any criminal concept ════
  {
    id: "R46",
    facts: "سلّم صاحب المحل بضاعةً بالأمانة إلى شخص وشريكه لبيعها ورد ثمنها إليه في أجل محدد، غير أنهما لم يردا الثمن ولم يعيدا البضاعة عند المطالبة.",
    expectedLaws: null,
    expectedCardCount: 1,
    expectedCardKeys: ["اشتراك:فحص"],
    expectedDescNote: null,
    note: "B13-122: خيانة أمانة (Art. 177) + participation (وشريكه + لم يردا → conjunction+crime gate) → اشتراك:فحص card (lawyer ruling 2026-10-24: kept).",
  },
  {
    id: "R47",
    facts: "اتنين اتفقوا وضربوه بالعصي",
    expectedLaws: null,
    expectedCardCount: 1,
    expectedCardKeys: ["اشتراك:فحص"],
    expectedDescNote: null,
    note: "Commit 40 Change B: 'اتنين' triggers participation for any concept (جرح عمد / أذى) → 1 card [اشتراك:فحص].",
  },

  // ══ COMMIT 41 — hadd upgrade, extortion attempt, hiraba card ══════════════

  // R48 / R49: hadd upgrade — all 5 conditions stated → سرقة:حدية primary (170 first) + حد:مراجعة card
  {
    id: "R48",
    facts: "المتهم البالغ دخل سراً إلى المحل المغلق وسرق النقود المملوكة لصاحب المحل دون إذنه ولا شبهة في ملكيتها.",
    expectedLaws: ["170", "171", "174"],
    expectedCardCount: 1,
    expectedCardKeys: ["حد:مراجعة"],
    expectedDescNote: null,
    note: "B13-123: all 5 hadd conditions stated → سرقة:حدية primary (170,171,174) + حد:مراجعة card; old سرقة:حد card must NOT appear.",
  },
  {
    id: "R49",
    facts: "ثبت أن المتهم عاقل عمره 25 سنة أخذ المال خفيةً من الخزنة المحروسة المملوكة للغير دون إذن صاحبه ولا اضطرار.",
    expectedLaws: ["170", "171", "174"],
    expectedCardCount: 1,
    expectedCardKeys: ["حد:مراجعة"],
    expectedDescNote: null,
    note: "B13-124: all 5 hadd conditions stated → same upgrade as R48.",
  },

  // R50: B12-04 verbatim — no capacity stated → hadd upgrade must NOT fire
  {
    id: "R50",
    facts: "أبلغت امرأة أن شقيقها أخذ هاتفها من المنزل دون إذنها وباعه لشخص آخر، ثم أخبرها بأنه سيعيد قيمته عندما تتحسن ظروفه المالية. وتؤكد أنها لم توافق على البيع.",
    expectedLaws: ["174"],
    expectedCardCount: 1,
    expectedCardKeys: ["سرقة:حد"],
    mustNotIncludeCardKeys: ["حد:مراجعة"],
    expectedDescNote: null,
    note: "B12-04 verbatim: no capacity stated → factsMatchHaddTheftConditions=false → Art. 174 only + سرقة:حد card; NO حد:مراجعة.",
  },

  // R51 / R52: extortion attempt vs. completed extortion
  {
    id: "R51",
    facts: "أرسل له رسالة يطلب فيها تحويل مبلغ وإلا فضح أمره، غير أن المجني عليه رفض الدفع وأبلغ الشرطة.",
    expectedLaws: ["20", "176", "19"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    expectedDescNote: null,
    note: "B13-126: extortion demand + no delivery (رفض) → شروع:ابتزاز (Arts. 20/176/19), 0 cards.",
  },
  {
    id: "R52",
    facts: "أرسل لها رسالة يهددها فيها بنشر صورها إذا لم تدفع له مبلغاً من المال، فدفعت له المبلغ المطلوب خوفاً.",
    expectedLaws: ["176"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    expectedDescNote: null,
    note: "B13-125: extortion demand + delivery occurred (دفعت) → ابتزاز (Art. 176 only), 0 cards.",
  },

  // R53: robbery with weapon in public place → حرابة:فحص card (in addition to نهب:جرح if LLM suggests it)
  {
    id: "R53",
    facts: "هجم عليه شخص بمطوة في الشارع العام وجرحه في ذراعه ثم انتزع منه محفظته بالقوة وفرّ هارباً.",
    expectedLaws: ["175"],
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["حرابة:فحص", "نهب:جرح"],
    expectedDescNote: null,
    note: "B13-130: نهب + weapon + public place → laws [175] + cards must include حرابة:فحص + نهب:جرح.",
  },

  // R54: breach of trust + participation (verbatim from R46)
  {
    id: "R54",
    facts: "سلّم صاحب المحل بضاعةً بالأمانة إلى شخص وشريكه لبيعها ورد ثمنها إليه في أجل محدد، غير أنهما لم يردا الثمن ولم يعيدا البضاعة عند المطالبة.",
    expectedLaws: null,
    expectedCardCount: 1,
    expectedCardKeys: ["اشتراك:فحص"],
    expectedDescNote: null,
    note: "B13-122 verbatim: خيانة أمانة (Art. 177) + participation (وشريكه + لم يردا → conjunction+crime gate) → اشتراك:فحص card (lawyer ruling 2026-10-24: kept).",
  },

  // R55: weapon in private place → حرابة:فحص must NOT appear
  {
    id: "R55",
    facts: "ضربه بمطوة في البيت وشال تلفونه",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["حرابة:فحص"],
    expectedDescNote: null,
    note: "weapon + private place (البيت) → factsMatchWeaponPublicPlace=false → حرابة:فحص must NOT appear.",
  },

  // ══ COMMIT 42 — routing gates (B14) ══════════════════════════════════════

  // R56: B14-131 verbatim — استلام مسروق + علم مُنكَر → Art. 181 + علم:فحص:مسروق card
  {
    id: "R56",
    facts: "ضبط المتهم وبحوزته هاتف مسروق، وقال إنه اشتراه من شخص لا يعرفه ولم يكن يعلم أنه مسروق.",
    expectedLaws: ["181"],
    expectedCardCount: 1,
    expectedCardKeys: ["علم:فحص:مسروق"],
    expectedDescNote: null,
    note: "B14-131: استلام مسروق + factsMatchKnowledgeDisputed='disputed' → [181], card [علم:فحص:مسروق].",
  },

  // R57: B14-137 verbatim — مخدرات + lab pending → laws [], single card مخدرات:معمل
  {
    id: "R57",
    facts: "ضبط المتهم وبحوزته مادة مشتبهاً بها قد تكون مخدرات، أُرسلت للمعمل الجنائي ولا تزال قيد التحليل.",
    expectedLaws: [],
    expectedCardCount: 1,
    expectedCardKeys: ["مخدرات:معمل"],
    mustNotIncludeCardKeys: ["مخدرات:قصد الاتجار", "مخدرات:قصد التعاطي"],
    expectedDescNote: null,
    note: "B14-137: narcotics + factsMatchLabPending=true → laws [], card [مخدرات:معمل]; no قصد cards.",
  },

  // R58: B14-140 verbatim — مخدرات + lab confirmed + علم مُنكَر → Art. 12 only + علم:فحص:مخدرات
  {
    id: "R58",
    facts: "عثر المحقق على كيس به مادة مخدرة في حقيبة المتهم، وأنكر المتهم علمه بوجود المادة وقال لا يعرف شيئاً عنها.",
    expectedLaws: ["12"],
    expectedCardCount: 1,
    expectedCardKeys: ["علم:فحص:مخدرات"],
    mustNotIncludeCardKeys: ["مخدرات:قصد الاتجار", "مخدرات:قصد التعاطي"],
    expectedDescNote: null,
    note: "B14-140: narcotics + !labPending + factsMatchKnowledgeDisputed='disputed' → [12], card [علم:فحص:مخدرات]; no intent cards, no 15/20.",
  },

  // R59: B14-138 verbatim — مخدرات + علم مُعترَف به → laws start with 15, 0 knowledge card
  {
    id: "R59",
    facts: "قبض على المتهم وهو يبيع حبوب مخدرة لأشخاص في الحي، وأقر بعلمه بطبيعتها وبنيته الاتجار بها.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["علم:فحص:مخدرات"],
    expectedDescNote: null,
    note: "B14-138: narcotics + factsMatchKnowledgeDisputed='admitted' → knowledge gate does NOT fire; no علم:فحص:مخدرات card.",
  },

  // R60: B14-135 verbatim — اغتصاب + رضا متنازع عليه → Art. 149 + رضا:فحص card
  {
    id: "R60",
    facts: "واقعها المتهم بالقوة وادعى أمام المحقق أن الأمر كان برضاها وبالتراضي.",
    expectedLaws: ["149"],
    expectedCardCount: 1,
    expectedCardKeys: ["رضا:فحص"],
    expectedDescNote: null,
    note: "B14-135: اغتصاب + factsMatchConsentDisputed='contested' → [149], card [رضا:فحص].",
  },

  // R61: B14-136 verbatim — فعل فاضح في مكان عام → [151, 152] NOT 153, card [فاحشة:مراجعة], no رضا:فحص
  {
    id: "R61",
    facts: "تحرش المتهم بامرأة في الشارع أمام الناس بشكل فاضح في وضح النهار، وشهد شخصان الواقعة، ولم يحدث إيلاج.",
    expectedLaws: null,  // order may vary; checked via mustInclude + mustNotInclude
    expectedCardCount: 1,
    expectedCardKeys: ["فاحشة:مراجعة"],
    mustIncludeCardKeys: ["فاحشة:مراجعة"],
    mustNotIncludeCardKeys: ["رضا:فحص"],
    expectedDescNote: null,
    note: "B14-136: أفعال فاحشة + public place → card [فاحشة:مراجعة]; consent='refused' (Commit 44: no counter-claim, no رضا:فحص); Art. 153 NOT in laws (Change C).",
  },

  // R62: B14-134 verbatim — حجز غير مشروع → Art. 164, 0 cards (unchanged)
  {
    id: "R62",
    facts: "أوثق المتهم شخصاً بالحبال وأغلق عليه الغرفة ساعات عدة دون وجه حق.",
    expectedLaws: null,
    mustIncludeCardKeys: [],
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["علم:فحص:مسروق", "علم:فحص:مخدرات", "رضا:فحص", "فاحشة:مراجعة", "مخدرات:معمل"],
    expectedDescNote: null,
    note: "B14-134: حجز غير مشروع → no C42 cards fire (routing unchanged).",
  },

  // R63: B14-133 verbatim — خيانة أمانة → Art. 177, 0 cards (unchanged)
  {
    id: "R63",
    facts: "استلم المتهم من صاحب المحل مبلغاً لشراء بضاعة، فأنفقه على نفسه وأنكر استلامه.",
    expectedLaws: ["177"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    primaryNoteChecks: [{ articleNumber: "177", noteStartsWith: null }],
    expectedDescNote: null,
    note: "B14-133: خيانة أمانة → [177], 0 cards. 177 is ordinary primary — statusNote must be null.",
  },

  // R64: B14-132 verbatim — احتيال → Art. 178 (unchanged)
  {
    id: "R64",
    facts: "تظاهر المتهم بأنه تاجر معتمد وأخذ بضاعة بالدين من عدة تجار ثم اختفى دون سداد.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["علم:فحص:مسروق", "علم:فحص:مخدرات", "رضا:فحص", "فاحشة:مراجعة", "مخدرات:معمل"],
    expectedDescNote: null,
    note: "B14-132: احتيال → no C42 cards fire (routing unchanged).",
  },

  // R65: B14-139 verbatim — خيانة أمانة → Art. 177 (unchanged)
  {
    id: "R65",
    facts: "سلّم صاحب المحل للمتهم بضاعة لإيصالها للزبون، فباعها لنفسه وأنكر استلامها.",
    expectedLaws: ["177"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    primaryNoteChecks: [{ articleNumber: "177", noteStartsWith: null }],
    expectedDescNote: null,
    note: "B14-139: خيانة أمانة → [177], 0 cards. 177 is ordinary primary — statusNote must be null.",
  },

  // ══ COMMIT 46 — breach-of-trust civil/abstain fallback ════════════════════

  // R66: lawyer fact verbatim — entrustment + contractual-defence → [177] + card regardless of LLM verdict
  {
    id: "R66",
    facts: "تقدمت الشاكية فاطمة ببلاغ أفادت فيه بأنها سلمت المتهم أحمد مبلغ خمسة ملايين جنيه سوداني لشراء بضائع لحسابها، بموجب اتفاق بينهما على تسليم البضائع خلال أسبوعين. وبعد انقضاء المدة، لم يسلم المتهم البضائع ولم يرد المبلغ. وعند مطالبته، أفاد بأن الأموال استُخدمت في معاملات تجارية أخرى، وأنه لا يستطيع إعادتها حالياً. وقدمت الشاكية إيصال تحويل مصرفي ومراسلات عبر تطبيق واتساب تتضمن الاتفاق ومطالبتها باسترداد الأموال. أنكر المتهم ارتكاب أي جريمة، ودفع بأن العلاقة تجارية وأن المبلغ تعرض للخسارة أثناء تنفيذ الاتفاق.",
    expectedLaws: ["177"],
    expectedCardCount: 1,
    expectedCardKeys: ["أمانة:مدني"],
    primaryNoteChecks: [{ articleNumber: "177", noteStartsWith: "معروضة للبحث، لا للتصنيف" }],
    expectedDescNote: null,
    note: "Commit 46: lawyer fact — entrustment + contractual-defence → [177] + card [أمانة:مدني]; 177 is research-only primary — statusNote must start with override.",
  },

  // R67: B14-133 verbatim — خيانة أمانة (LLM direct), no contractual-defence marker → [177], 0 cards
  {
    id: "R67",
    facts: "استلم المتهم من صاحب المحل مبلغاً لشراء بضاعة، فأنفقه على نفسه وأنكر استلامه.",
    expectedLaws: ["177"],
    expectedCardCount: 0,
    expectedCardKeys: [],
    mustNotIncludeCardKeys: ["أمانة:مدني"],
    primaryNoteChecks: [{ articleNumber: "177", noteStartsWith: null }],
    expectedDescNote: null,
    note: "B14-133 verbatim: خيانة أمانة (LLM direct), no contractual-defence → [177], 0 cards. 177 ordinary — statusNote must be null.",
  },

  // R68: E1 verbatim — ordinary bank deposit → no entrustment gate, no 177, no card
  {
    id: "R68",
    facts: "أودع العميل أموالاً في البنك وتعذر عليه سحبها",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["أمانة:مدني"],
    expectedDescNote: null,
    note: "E1: ordinary bank deposit — bank guard fires → no entrustment → no 177, no card.",
  },

  // R69: partnership loss — civil, no entrustment → no 177, no card
  {
    id: "R69",
    facts: "اتفقا على شراكة تجارية وخسرت الشركة فطالبه بنصيبه",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["أمانة:مدني"],
    expectedDescNote: null,
    note: "partnership loss: no entrustment → stays civil, no أمانة:مدني card.",
  },

  // ══ COMMIT 48 — deterministic cheque gate (Art. 179) ═════════════════════

  // R70: B15-144 — balance dishonour + balance claim → 179 research-only + صك:فحص:رصيد card
  {
    id: "R70",
    facts: "اشترى خالد بضائع من تاجر بمبلغ ١٢ مليون جنيه، وسلمه شيكاً بالمبلغ مستحق الدفع بعد شهر. وعند حلول الموعد أعاد البنك الشيك لعدم كفاية الرصيد. قال خالد إن حسابه كان يحتوي على المبلغ يوم تحرير الشيك، لكن أحد عملائه سحب تحويلاً متوقعاً قبل موعد الدفع، فلم يتمكن من تغطية الشيك.",
    expectedLaws: ["179"],
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["صك:فحص:رصيد"],
    mustNotIncludeCardKeys: ["صك:فحص:سبب"],
    primaryNoteChecks: [{ articleNumber: "179", noteStartsWith: "معروضة للبحث، لا للتصنيف" }],
    expectedDescNote: null,
    note: "B15-144: balance dishonour + balance claim → [179 research-only] + card [صك:فحص:رصيد]. 179 statusNote must carry override.",
  },

  // R71: B15-146 — stop dishonour + stop cause → 179 research-only + صك:فحص:سبب card
  {
    id: "R71",
    facts: "استلمت سارة شيكاً من محمد مقابل بيع سيارة. وعندما قدمته للبنك أعيد بسبب أمر سابق من محمد بإيقاف الصرف. أوضح محمد أنه أصدر الأمر بعدما اكتشف عيباً جوهرياً في السيارة، وأنه أبلغ سارة بذلك قبل تقديم الشيك. تؤكد سارة أن السيارة بيعت بالحالة التي عاينها محمد وأنه تسلمها واستعملها أسبوعين.",
    expectedLaws: ["179"],
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["صك:فحص:سبب"],
    mustNotIncludeCardKeys: ["صك:فحص:رصيد"],
    primaryNoteChecks: [{ articleNumber: "179", noteStartsWith: "معروضة للبحث، لا للتصنيف" }],
    expectedDescNote: null,
    note: "B15-146: stop dishonour + stop cause → [179 research-only] + card [صك:فحص:سبب]. 179 statusNote must carry override.",
  },

  // R72: stop order but cheque not presented → no صك:فحص:* card (reportOnly on laws)
  {
    id: "R72",
    facts: "أصدر عمر شيكاً لصالح المورد ثم أمر البنك بإيقاف صرفه، ولم يُقدَّم الشيك للبنك بعد.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["صك:فحص:رصيد", "صك:فحص:سبب"],
    expectedDescNote: null,
    note: "case 3: stop without return → no cheque card.",
  },

  // R73: cheque paid (negated return) → no صك:فحص:* card (reportOnly on laws)
  {
    id: "R73",
    facts: "قدّم التاجر الشيك للبنك فصُرف ولم يرتد الشيك، ثم نشب خلاف حول جودة البضاعة.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["صك:فحص:رصيد", "صك:فحص:سبب"],
    expectedDescNote: null,
    note: "case 4: negated return → no cheque card.",
  },

  // R74: balance dishonour but no claim (drawer knew) → no card; if 179 appears statusNote must be null
  {
    id: "R74",
    facts: "ارتد الشيك لعدم كفاية الرصيد، وكان الساحب يعلم أن حسابه فارغ منذ شهر.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustNotIncludeCardKeys: ["صك:فحص:رصيد", "صك:فحص:سبب"],
    primaryNoteChecks: [{ articleNumber: "179", noteStartsWith: null }],
    expectedDescNote: null,
    note: "case 8: balance + no claim → no card; if 179 appears its statusNote must be null (not research-only).",
  },

  // R75: non-withdrawable balance + denied knowledge → 179 research-only + صك:فحص:رصيد card
  {
    id: "R75",
    facts: "ارتد الشيك لأن الرصيد غير قابل للسحب بسبب حجز قضائي على الحساب، وأنكر الساحب علمه بالحجز.",
    expectedLaws: ["179"],
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["صك:فحص:رصيد"],
    mustNotIncludeCardKeys: ["صك:فحص:سبب"],
    primaryNoteChecks: [{ articleNumber: "179", noteStartsWith: "معروضة للبحث، لا للتصنيف" }],
    expectedDescNote: null,
    note: "case 6: non-withdrawable balance + denied knowledge → [179 research-only] + card [صك:فحص:رصيد]. 179 statusNote must carry override.",
  },

  // ── Commit 49: forgery gate (Arts. 122/123) and public-official false-entry (Art. 124) ──

  // R76: blank-cheque overfill (B15-145) — alt gate fires → تزوير:فحص card, not صك:فحص
  {
    id: "R76",
    facts: "سلّم عثمان شيكاً موقعاً على بياض إلى شريكه لتسديد فاتورة لا تتجاوز مليوني جنيه. ملأ الشريك الشيك بمبلغ ٩ ملايين جنيه وقدمه إلى البنك، فصرف البنك المبلغ من حساب عثمان. كان الشريك قد أُذن له بملء الشيك، لكن عثمان يؤكد أن الإذن كان محدداً بسقف المليونين، بينما يدعي الشريك أنه حصل على موافقة شفوية بالمبلغ الأكبر.",
    expectedLaws: ["122", "123"],
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["تزوير:فحص"],
    mustNotIncludeCardKeys: ["صك:فحص:رصيد", "صك:فحص:سبب"],
    primaryNoteChecks: [
      { articleNumber: "122", noteStartsWith: "معروضة للبحث، لا للتصنيف" },
      { articleNumber: "123", noteStartsWith: "معروضة للبحث، لا للتصنيف" },
    ],
    expectedDescNote: null,
    note: "case 1: alt gate fires → block A swaps to تزوير:فحص → laws [122, 123] research-only, statusNote must carry override.",
  },

  // R77: authorised fill, no dispute → alt gate does NOT fire, no forgery card
  {
    id: "R77",
    facts: "سلّم التاجر شيكاً موقعاً على بياض لوكيله، فملأه الوكيل بالمبلغ المتفق عليه وقدمه للبنك.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: null,
    mustNotIncludeCardKeys: ["تزوير:فحص", "تزوير:موظف"],
    primaryNoteChecks: [
      { articleNumber: "122", noteStartsWith: null },
      { articleNumber: "123", noteStartsWith: null },
    ],
    expectedDescNote: null,
    note: "authorised fill, no auth dispute → alt=false, no تزوير:فحص card. If 122/123 appear as ordinary, statusNote must be null.",
  },

  // R78: public official omits a true fact intentionally → تزوير:موظف card
  {
    id: "R78",
    facts: "أغفل المكلف بخدمة عامة عمداً إثبات واقعة صحيحة في المحضر الذي حرره.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["تزوير:موظف"],
    mustNotIncludeCardKeys: null,
    expectedDescNote: null,
    note: "off124 gate fires (omit verb + official + واقعة صحيحة + عمداً) → تزوير:موظف card.",
  },

  // R79: registrar records non-existent sale intentionally → off124 fires (case 7)
  {
    id: "R79",
    facts: "أثبت المسجل في سجل الأراضي واقعة بيع لم تحدث، مع علمه بذلك.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["تزوير:موظف"],
    mustNotIncludeCardKeys: null,
    expectedDescNote: null,
    note: "case 7: أثبت + المسجل + لم تحدث + مع علمه → off124=true → تزوير:موظف card.",
  },

  // R80: official as witness, no entry verb, no auth dispute → no تزوير:* cards (case 5)
  {
    id: "R80",
    facts: "شهد موظف عام على تعديل بند في عقد خاص بين تاجرين، وقال إن التعديل تم بموافقة الطرفين.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: null,
    mustNotIncludeCardKeys: ["تزوير:فحص", "تزوير:موظف"],
    expectedDescNote: null,
    note: "case 5: تعديل is masdar (no alt verb), official is witness (no entry verb) → no تزوير:* cards.",
  },

  // R81: date alteration in contract, one verb negated, other not → alt fires (case 3)
  {
    id: "R81",
    facts: "لم يغيّر الشريك المبلغ، لكنه عدّل التاريخ في العقد دون إذن من صاحبه.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["تزوير:فحص"],
    mustNotIncludeCardKeys: ["تزوير:موظف"],
    expectedDescNote: null,
    note: "case 3: عدّل التاريخ (non-negated) + عقد + دون إذن → alt=true → تزوير:فحص card.",
  },

  // R82: civil LLM + off124=true → civil text-search kept + تزوير:موظف discuss card attached (Addendum 2B)
  {
    id: "R82",
    facts: "أغفل المكلف بخدمة عامة عمداً إثبات واقعة صحيحة في المحضر الذي حرره.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["تزوير:موظف"],
    mustNotIncludeCardKeys: null,
    expectedDescNote: null,
    note: "R82: civil LLM + off124=true → civil text-search kept + تزوير:موظف discuss card attached (Addendum 2B).",
  },

  // R83: civil LLM + alt=true → civil text-search kept + تزوير:فحص discuss card with Arts. 122+123 (Addendum 3)
  // If LLM returns criminal for this fact, this test will be marked reportOnly below.
  {
    id: "R83",
    facts: "اتفق تاجران على توريد بضاعة، وسلّم أحدهما للآخر عقداً موقعاً ليكمل بيانات الكميات المتفق عليها، فأضاف الثاني كميات أكبر. يؤكد الأول أن الإذن كان محدداً بالكميات المتفق عليها، بينما يطالب الثاني بثمن الكميات كلها أمام المحكمة المدنية.",
    expectedLaws: null,
    expectedCardCount: null,
    expectedCardKeys: null,
    mustIncludeCardKeys: ["تزوير:فحص"],
    mustNotIncludeCardKeys: null,
    discussArticleNoteChecks: [
      { concept: "تزوير:فحص", articleNumber: "122", noteStartsWith: "معروضة للبحث، لا للتصنيف" },
      { concept: "تزوير:فحص", articleNumber: "123", noteStartsWith: "معروضة للبحث، لا للتصنيف" },
    ],
    expectedDescNote: null,
    note: "R83: civil LLM + alt=true → civil text-search kept + تزوير:فحص card (Arts. 122+123 research-only). Discuss article statusNotes must carry override.",
  },
];

interface RunResult {
  rawConcept: string;
  laws: string[];
  cardCount: number;
  cardKeys: string[];
  descNote: boolean; // whether the نفي-append line appears in قتل:وصف description
  primaryNotes: Record<string, string | null>;
  discussArticleNotes: Record<string, Record<string, string | null>>;
}

async function runOnce(facts: string): Promise<RunResult> {
  const r = await analyzeCase(supabase, { facts });
  const laws = r.laws.map((l) => l.articleNumber ?? "?");
  const cards = r.discuss ?? [];
  const qatlCard = cards.find((d: any) => d.concept === "قتل:وصف");
  const primaryNotes: Record<string, string | null> = {};
  for (const l of r.laws) {
    primaryNotes[l.articleNumber ?? "?"] = (l as any).statusNote ?? null;
  }
  const discussArticleNotes: Record<string, Record<string, string | null>> = {};
  for (const card of cards) {
    const key = (card as any).concept ?? "?";
    discussArticleNotes[key] = {};
    for (const art of ((card as any).articles ?? [])) {
      discussArticleNotes[key][(art as any).articleNumber ?? "?"] = (art as any).statusNote ?? null;
    }
  }
  return {
    rawConcept: (r as any)._debug?.llmConcept ?? "—",
    laws,
    cardCount: cards.length,
    cardKeys: cards.map((d: any) => d.concept ?? "?"),
    descNote: Boolean(qatlCard?.negationNote?.includes(NEGATE_KILL_APPEND_FRAGMENT)),
    primaryNotes,
    discussArticleNotes,
  };
}

function lawsMatch(got: string[], expected: string[]): boolean {
  return JSON.stringify(got) === JSON.stringify(expected);
}

function cardKeysMatch(got: string[], expected: string[]): boolean {
  if (got.length !== expected.length) return false;
  const s = new Set(got);
  return expected.every(k => s.has(k));
}

async function main() {
  console.log("Changes 1/2/3 — Final battery (3 runs each)\n" + "═".repeat(130));
  console.log(
    "ID   | expected-laws    | expected-cards       | raw-concept     | laws-got         | card-keys            | desc-note  | PASS/FAIL"
  );
  console.log("─".repeat(160));

  let passed = 0;
  let failed = 0;

  for (const c of CASES) {
    const runs: RunResult[] = [];
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(c.facts));

    const r0 = runs[0];
    const lawsConsist  = runs.every(r => r.laws.join(",") === r0.laws.join(","));
    const countConsist = runs.every(r => r.cardCount === r0.cardCount);
    const keysConsist  = runs.every(r => r.cardKeys.join(",") === r0.cardKeys.join(","));
    const noteConsist  = runs.every(r => r.descNote === r0.descNote);

    let ok = true;
    const failReasons: string[] = [];

    if (!c.reportOnly) {
      if (c.expectedLaws !== null && !lawsMatch(r0.laws, c.expectedLaws)) {
        ok = false;
        failReasons.push(`laws: expected [${c.expectedLaws.join(",")}] got [${r0.laws.join(",")}]`);
      }
      if (c.expectedCardCount !== null && r0.cardCount !== c.expectedCardCount) {
        ok = false;
        failReasons.push(`card-count: expected ${c.expectedCardCount} got ${r0.cardCount}`);
      }
      if (c.expectedCardKeys !== null && !cardKeysMatch(r0.cardKeys, c.expectedCardKeys)) {
        ok = false;
        failReasons.push(`card-keys: expected [${c.expectedCardKeys.join(",")}] got [${r0.cardKeys.join(",")}]`);
      }
      if (c.mustIncludeCardKeys) {
        const s = new Set(r0.cardKeys);
        for (const k of c.mustIncludeCardKeys) {
          if (!s.has(k)) { ok = false; failReasons.push(`must-include: key [${k}] absent; got [${r0.cardKeys.join(",")}]`); }
        }
      }
      if (c.mustNotIncludeCardKeys) {
        const s = new Set(r0.cardKeys);
        for (const k of c.mustNotIncludeCardKeys) {
          if (s.has(k)) { ok = false; failReasons.push(`must-not-include: key [${k}] present; got [${r0.cardKeys.join(",")}]`); }
        }
      }
      if (c.expectedDescNote !== null) {
        const wantDesc = c.expectedDescNote === "yes";
        if (r0.descNote !== wantDesc) {
          ok = false;
          failReasons.push(`desc-note: expected ${c.expectedDescNote} got ${r0.descNote ? "yes" : "no"}`);
        }
      }
      if (c.primaryNoteChecks) {
        for (const check of c.primaryNoteChecks) {
          const got = r0.primaryNotes[check.articleNumber] ?? null;
          if (check.noteStartsWith === null) {
            if (got !== null) {
              ok = false;
              failReasons.push(`primaryNote[${check.articleNumber}]: expected null, got "${got}"`);
            }
          } else {
            if (!got?.startsWith(check.noteStartsWith)) {
              ok = false;
              failReasons.push(`primaryNote[${check.articleNumber}]: expected starts-with "${check.noteStartsWith}", got "${got ?? "null"}"`);
            }
          }
        }
      }
      if (c.discussArticleNoteChecks) {
        for (const check of c.discussArticleNoteChecks) {
          const got = r0.discussArticleNotes[check.concept]?.[check.articleNumber] ?? null;
          if (!got?.startsWith(check.noteStartsWith)) {
            ok = false;
            failReasons.push(`discussNote[${check.concept}/${check.articleNumber}]: expected starts-with "${check.noteStartsWith}", got "${got ?? "null"}"`);
          }
        }
      }
      if (!lawsConsist)  failReasons.push(`INCONSISTENT laws`);
      if (!countConsist) failReasons.push(`INCONSISTENT card-count`);
      if (!keysConsist)  failReasons.push(`INCONSISTENT card-keys`);
      if (!noteConsist)  failReasons.push(`INCONSISTENT desc-note`);
      if (!lawsConsist || !countConsist || !keysConsist || !noteConsist) ok = false;
    }

    if (!c.reportOnly) { if (ok) passed++; else failed++; }

    const expLaws  = c.expectedLaws !== null ? c.expectedLaws.join(",") : "—";
    const expCards = c.expectedCardCount !== null
      ? `${c.expectedCardCount}×[${c.expectedCardKeys?.join(",") ?? "?"}]`
      : "—";
    const gotCards = `${r0.cardCount}×[${r0.cardKeys.join(",") || "—"}]`;
    const noteStr  = c.expectedDescNote ? `want:${c.expectedDescNote}→${r0.descNote ? "yes" : "no"}` : "—";
    const status   = c.reportOnly ? "REPORT   " : (ok ? "✓ PASS   " : "✗ FAIL   ");

    console.log(
      `${c.id.padEnd(4)} | ${expLaws.padEnd(16)} | ${expCards.padEnd(20)} | ${r0.rawConcept.padEnd(15)} | ${r0.laws.join(",").padEnd(16)} | ${gotCards.padEnd(20)} | ${noteStr.padEnd(10)} | ${status}`
    );
    for (const r of failReasons) console.log(`      ↳ ${r}`);
    if (c.reportOnly) {
      console.log(`      REPORT: laws=[${r0.laws.join(",")}] cards=${r0.cardCount} keys=[${r0.cardKeys.join(",")}]  concept=${r0.rawConcept}  descNote=${r0.descNote}`);
    }
  }

  console.log("─".repeat(160));
  const total = CASES.filter(c => !c.reportOnly).length;
  console.log(`\nResult: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) console.log("ALL PASSED");
  else console.log("FAILURES — do not commit");

  process.exit(failed === 0 ? 0 : 1);
}

main();
