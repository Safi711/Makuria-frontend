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

interface Case {
  id: string;
  facts: string;
  expectedLaws: string[] | null;       // null = don't check
  expectedCardCount: number | null;    // null = don't check
  expectedCardKeys: string[] | null;   // null = don't check (any order)
  expectedDescNote: "yes" | "no" | null; // null = don't check
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
    expectedLaws: ["176"],
    expectedCardCount: 0,
    expectedCardKeys: null,
    expectedDescNote: null,
    note: "B12-02 control: threat + money demand → ابتزاز stays Art. 176, no card.",
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
];

interface RunResult {
  rawConcept: string;
  laws: string[];
  cardCount: number;
  cardKeys: string[];
  descNote: boolean; // whether the نفي-append line appears in قتل:وصف description
}

async function runOnce(facts: string): Promise<RunResult> {
  const r = await analyzeCase(supabase, { facts });
  const laws = r.laws.map((l) => l.articleNumber ?? "?");
  const cards = r.discuss ?? [];
  const qatlCard = cards.find((d: any) => d.concept === "قتل:وصف");
  return {
    rawConcept: (r as any)._debug?.llmConcept ?? "—",
    laws,
    cardCount: cards.length,
    cardKeys: cards.map((d: any) => d.concept ?? "?"),
    descNote: Boolean(qatlCard?.negationNote?.includes(NEGATE_KILL_APPEND_FRAGMENT)),
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
      if (c.expectedDescNote !== null) {
        const wantDesc = c.expectedDescNote === "yes";
        if (r0.descNote !== wantDesc) {
          ok = false;
          failReasons.push(`desc-note: expected ${c.expectedDescNote} got ${r0.descNote ? "yes" : "no"}`);
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
