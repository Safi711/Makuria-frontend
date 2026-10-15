/**
 * Section E — Final battery (updated).
 * 3 runs each.
 * Table: ID | expected-laws | expected-card | raw LLM concept | laws-got | card-count | card-key | PASS/FAIL | note
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const RUNS = 3;

interface Case {
  id: string;
  facts: string;
  expectedLaws: string[] | null;
  expectedCardCount: number | null;   // null = don't check
  expectedCardKey: string | null;     // null = don't check
  reportOnly?: boolean;
  note: string;
}

const CASES: Case[] = [
  // ── O series — stick + death, disputed intent ────────────────────────────
  { id:"O1", facts:"ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"deliberate-assault gate → قتل:وصف CARD" },
  { id:"O2", facts:"ضربه بعصا على رأسه ولم يكن ذلك بقصد قتله فتوفي.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"قتل:وصف open point" },
  { id:"O3", facts:"ضربه بعصا فتوفي، ونفى المتهم أنه أراد قتله.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"قتل:وصف open point" },
  { id:"O4", facts:"ضربه بعصا فتوفي، وأنكر المتهم أنه كان قاصداً قتله.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"قتل:وصف open point" },
  // ── H series ────────────────────────────────────────────────────────────
  { id:"H1", facts:"لكم المتهم المجني عليه في وجهه فسقط على الرصيف ومات، وقال إنه لم يقصد قتله.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"لكم → قتل:وصف" },
  { id:"H2", facts:"دفع المتهم جاره من على السلم أثناء مشادة فتوفي متأثراً بإصابته، وأنكر نية القتل.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"دفع → قتل:وصف" },
  // ── K series — clear lethal weapon killing ───────────────────────────────
  { id:"K1", facts:"طعن المتهم المجني عليه بسكين في صدره فتوفي، ونفى أنه أراد قتله.", expectedLaws:["130","129"], expectedCardCount:0, expectedCardKey:null, note:"سكين + death → 130,129 no card" },
  { id:"K2", facts:"أطلق المتهم النار على المجني عليه فأرداه قتيلاً، وأنكر قصد القتل.", expectedLaws:["130","129"], expectedCardCount:0, expectedCardKey:null, note:"proximity: أطلق + النار → 130,129 no card" },
  // ── W series ─────────────────────────────────────────────────────────────
  { id:"W1", facts:"ضربه بعصا فجرحه، ثم مات المجني عليه بعد أسابيع بالملاريا.", expectedLaws:["139","138"], expectedCardCount:0, expectedCardKey:null, note:"independent cause (ملاريا) → wound, no card" },
  { id:"W2", facts:"طعنه بمطوة في فخذه فنزف ونُقل إلى المستشفى وخرج بعد أسبوع.", expectedLaws:["139","138"], expectedCardCount:1, expectedCardKey:"شروع:سلاح", note:"مطوة + alive → weapon card شروع:سلاح" },
  // ── G series ─────────────────────────────────────────────────────────────
  { id:"G9",  facts:"سائق انشغل بهاتفه ولم ينتبه، صدم مشاة فتوفي، دون قصد اعتداء.", expectedLaws:["132"], expectedCardCount:0, expectedCardKey:null, note:"traffic negligence → 132 no card" },
  { id:"G10", facts:"ضرب شخص آخر بسكين عمدًا، فأحدث جرحًا قطعيًا مثبتًا طبيًا، دون وفاته.", expectedLaws:["139","138"], expectedCardCount:1, expectedCardKey:"شروع:سلاح", note:"Golden 10: بسكين + alive → weapon card" },
  // ── Shooting extras ───────────────────────────────────────────────────────
  { id:"K3", facts:"أطلق المتهم على المجني عليه النار من مسافة قريبة فمات.", expectedLaws:["130","129"], expectedCardCount:0, expectedCardKey:null, note:"shooting + death → 130,129 no card" },
  { id:"K4", facts:"أطلق عليه المتهم ثلاث رصاصات فأصابته في كتفه ونجا.", expectedLaws:["139","138"], expectedCardCount:1, expectedCardKey:"شروع:سلاح", note:"shooting + alive → weapon card" },
  // ── Stay-132 (deliberate-assault gate must NOT fire) ─────────────────────
  { id:"S1", facts:"كان ينظف بندقيته فانطلقت منها رصاصة فأصابت جاره فتوفي.", expectedLaws:["132"], expectedCardCount:0, expectedCardKey:null, note:"accidental discharge → 132 no card" },
  { id:"S2", facts:"أهمل الطبيب تعقيم الأدوات الجراحية فأصيب المريض بعدوى وتوفي.", expectedLaws:["132"], expectedCardCount:0, expectedCardKey:null, note:"medical negligence → 132 no card" },
  { id:"S3", facts:"دفع المقاول أجور العمال ثم سقط الجدار الذي بناه على أحدهم فتوفي.", expectedLaws:["132"], expectedCardCount:0, expectedCardKey:null, note:"construction negligence → 132 no card" },
  // ── METHOD rows (Section 2) ───────────────────────────────────────────────
  // M1–M4: lawyer approved card key only; observed laws=139,138 but NOT approved
  { id:"M1", facts:"خنقه حتى أغمي عليه ثم أفاق.", expectedLaws:null /* observed: 139,138 */, expectedCardCount:1, expectedCardKey:"شروع:خنق", note:"خنق + alive → method card شروع:خنق" },
  { id:"M2", facts:"دسّ المتهم السم في شراب المجني عليه فنُقل إلى المستشفى ونجا.", expectedLaws:null /* observed: 139,138 */, expectedCardCount:1, expectedCardKey:"شروع:سم", note:"سم + alive → method card شروع:سم" },
  { id:"M3", facts:"سكب عليه البنزين وأشعل فيه النار فأصيب بحروق ونجا.", expectedLaws:null /* observed: 139,138 */, expectedCardCount:1, expectedCardKey:"شروع:حرق", note:"حرق + alive → method card شروع:حرق" },
  { id:"M4", facts:"أغرق المتهم المجني عليه في الترعة حتى أنقذه المارة.", expectedLaws:null /* observed: 139,138 */, expectedCardCount:1, expectedCardKey:"شروع:إغراق", note:"إغراق + alive → method card شروع:إغراق" },
  { id:"M5", facts:"حاول المتهم ذبح المجني عليه فأصابه بجرح في عنقه ونجا.", expectedLaws:["139","138"], expectedCardCount:1, expectedCardKey:"شروع:ذبح", note:"ذبح + alive → method card شروع:ذبح (not weapon)" },
  { id:"M6", facts:"حاول ذبحه بسكين فجرحه في عنقه ونجا.", expectedLaws:["139","138"], expectedCardCount:1, expectedCardKey:"شروع:ذبح", note:"ذبح + سكين + alive → method card شروع:ذبح (method wins over weapon)" },
  // ── BLADES ────────────────────────────────────────────────────────────────
  { id:"B1", facts:"طعنه بخنجر في كتفه فأصيب ونجا.", expectedLaws:["139","138"], expectedCardCount:1, expectedCardKey:"شروع:سلاح", note:"خنجر + alive → weapon card شروع:سلاح" },
  // ── NO card ───────────────────────────────────────────────────────────────
  { id:"N1", facts:"ضرب المتهم جاره بعصا على رأسه فأحدث به جرحاً.", expectedLaws:["139","138"], expectedCardCount:0, expectedCardKey:null, note:"عصا (blunt) → wound, no card" },
  { id:"N2", facts:"جرح العامل إصبع زميله خطأً بسكين أثناء تقطيع اللحم.", expectedLaws:["141","138"], expectedCardCount:0, expectedCardKey:null, note:"خطأ + knife → جرح خطأ, no card (concept not جرح عمد)" },
  { id:"N3", facts:"غرق الطفل في الترعة أثناء غياب والده.", expectedLaws:null, expectedCardCount:0, expectedCardKey:null, note:"NO card (lawyer spec); laws not specified" },
  { id:"N4", facts:"أحرق المتهم محصول جاره.", expectedLaws:null, expectedCardCount:0, expectedCardKey:null, note:"property crime → no bodily harm, no card" },
  // ── OPEN POINT ───────────────────────────────────────────────────────────
  { id:"OP1", facts:"ركل المتهم المجني عليه في بطنه دون قصد قتله فمات بعد ساعات.", expectedLaws:["129"], expectedCardCount:1, expectedCardKey:"قتل:وصف", note:"ركل + death + denial → deliberate-assault gate → قتل:وصف" },
  // ── R1 — report only ─────────────────────────────────────────────────────
  { id:"R1", facts:"طعنه بسكين في صدره دون أن يقصد قتله فتوفي.", expectedLaws:null, expectedCardCount:null, expectedCardKey:null, reportOnly:true, note:"REPORT ONLY — lawyer to rule" },
];

interface RunResult {
  rawConcept: string;
  laws: string[];
  cardCount: number;
  cardKeys: string[];
}

async function runOnce(facts: string): Promise<RunResult> {
  const r = await analyzeCase(supabase, { facts });
  const laws = r.laws.map((l) => l.articleNumber ?? "?");
  const cards = r.discuss ?? [];
  return {
    rawConcept: (r as any)._debug?.llmConcept ?? "—",
    laws,
    cardCount: cards.length,
    cardKeys: cards.map((d: any) => d.concept ?? "?"),
  };
}

function lawsMatch(got: string[], expected: string[]): boolean {
  return JSON.stringify(got) === JSON.stringify(expected);
}

async function main() {
  console.log("Section E — Final battery (3 runs each)\n" + "═".repeat(110));
  console.log(
    "ID   | expected-laws    | exp-card       | raw-concept     | laws-got         | cards  | card-key       | PASS/FAIL | note"
  );
  console.log("─".repeat(170));

  let passed = 0;
  let failed = 0;

  for (const c of CASES) {
    const runs: RunResult[] = [];
    for (let i = 0; i < RUNS; i++) {
      runs.push(await runOnce(c.facts));
    }

    const firstLaws = runs[0].laws.join(",");
    const firstCount = runs[0].cardCount;
    const firstKeys = runs[0].cardKeys;
    const firstConcept = runs[0].rawConcept;

    const lawsConsist  = runs.every(r => r.laws.join(",") === firstLaws);
    const countConsist = runs.every(r => r.cardCount === firstCount);
    const keysConsist  = runs.every(r => r.cardKeys.join(",") === firstKeys.join(","));

    let ok = true;
    const failReasons: string[] = [];

    if (!c.reportOnly) {
      if (c.expectedLaws !== null && !lawsMatch(runs[0].laws, c.expectedLaws)) {
        ok = false;
        failReasons.push(`laws: expected [${c.expectedLaws.join(",")}] got [${firstLaws}]`);
      }
      if (c.expectedCardCount !== null && firstCount !== c.expectedCardCount) {
        ok = false;
        failReasons.push(`card-count: expected ${c.expectedCardCount} got ${firstCount}`);
      }
      if (c.expectedCardKey !== null && !firstKeys.includes(c.expectedCardKey)) {
        ok = false;
        failReasons.push(`card-key: expected ${c.expectedCardKey} got [${firstKeys.join(",")}]`);
      }
      if (!lawsConsist)  failReasons.push(`INCONSISTENT laws: ${runs.map(r => r.laws.join(",")).join(" | ")}`);
      if (!countConsist) failReasons.push(`INCONSISTENT card-count: ${runs.map(r => r.cardCount).join(" | ")}`);
      if (!keysConsist)  failReasons.push(`INCONSISTENT card-keys: ${runs.map(r => r.cardKeys.join(",")).join(" | ")}`);
      if (!lawsConsist || !countConsist || !keysConsist) ok = false;
    }

    if (!c.reportOnly) { if (ok) passed++; else failed++; }

    const expLawsStr  = c.expectedLaws !== null ? c.expectedLaws.join(",") : "—";
    const expCardStr  = c.expectedCardCount !== null ? `${c.expectedCardCount}×${c.expectedCardKey ?? "?"}` : "—";
    const cardStr     = `${firstCount}×`;
    const keyStr      = firstKeys.join(",") || "—";
    const statusStr   = c.reportOnly ? "REPORT   " : (ok ? "✓ PASS   " : "✗ FAIL   ");

    console.log(
      `${c.id.padEnd(4)} | ${expLawsStr.padEnd(16)} | ${expCardStr.padEnd(14)} | ${firstConcept.padEnd(15)} | ${firstLaws.padEnd(16)} | ${cardStr.padEnd(6)} | ${keyStr.padEnd(14)} | ${statusStr} | ${c.note}`
    );
    for (const r of failReasons) console.log(`      ↳ ${r}`);
    if (c.reportOnly) {
      console.log(`      REPORT: laws=[${firstLaws}] cards=${firstCount} keys=[${firstKeys.join(",")}]  concept=${firstConcept}`);
    }
  }

  console.log("─".repeat(170));
  const total = CASES.filter(c => !c.reportOnly).length;
  console.log(`\nResult: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) console.log("ALL PASSED");
  else console.log("FAILURES — do not commit");

  process.exit(failed === 0 ? 0 : 1);
}

main();
