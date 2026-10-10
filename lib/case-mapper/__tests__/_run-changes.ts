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
    descNote: Boolean(qatlCard?.description?.includes(NEGATE_KILL_APPEND_FRAGMENT)),
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
