/**
 * Full-law-list regression tests.
 * Checks the complete ordered article list, not rank-1 only.
 * Catches tail noise (unwanted articles appended after the correct rank-1).
 *
 * Run: npx tsx lib/case-mapper/__tests__/test-regression-full-laws.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

type Case = {
  id: string;
  facts: string;
  expectedLaws: string[];          // exact ordered article numbers
  expectedDiscussCount: number;    // number of open-point cards
  note: string;
};

const CASES: Case[] = [
  // (a) Robbery — expansion used to inject "أذى"/"جرح" via ضرب; post-C11 only نهب survives
  {
    id: "REG-01",
    facts: "ضرب المتهم الحارس وأخذ منه الهاتف بالقوة.",
    expectedLaws: ["175"],
    expectedDiscussCount: 0,
    note: "نهب: Art. 175 only — no wound articles from ضرب expansion",
  },
  // (b) Slap — no wound, only أذى; expansion used to inject "جرح" via ضرب; post-C11 only أذى survives
  {
    id: "REG-02",
    facts: "ضرب المتهم جاره كفاً على وجهه ولم يحدث به جرحاً.",
    expectedLaws: ["142"],
    expectedDiscussCount: 0,
    note: "أذى: Art. 142 only — no wound articles from ضرب expansion",
  },
  // (c) Homicide open point — stick, no explicit intent, no lethal weapon keyword
  //     laws:[129] (definition only), discuss card قتل:وصف
  {
    id: "REG-03",
    facts: "ضرب المتهم المجني عليه بعصا على رأسه فتوفي بعد يومين.",
    expectedLaws: ["129"],
    expectedDiscussCount: 1,
    note: "قتل:وصف open point — laws:[129], 1 discuss card",
  },
  // (d) Homicide open point — brawl push, no intent phrase, no lethal weapon keyword
  {
    id: "REG-04",
    facts: "لكم المتهم المجني عليه أثناء مشاجرة فسقط وتوفي.",
    expectedLaws: ["129"],
    expectedDiscussCount: 1,
    note: "قتل:وصف open point — laws:[129], 1 discuss card",
  },
  // Golden 10: جرح عمد + بسكين → weapon card شروع:سلاح fires deterministically
  {
    id: "REG-G10",
    facts: "ضرب شخص آخر بسكين عمدًا، فأحدث جرحًا قطعيًا مثبتًا طبيًا، دون وفاته.",
    expectedLaws: ["139", "138"],
    expectedDiscussCount: 1,
    note: "Golden 10: جرح عمد + بسكين → weapon card شروع:سلاح — laws:[139,138], discuss:1",
  },
];

async function main() {
  let allPassed = true;
  console.log("Full-law-list regression — " + CASES.length + " cases\n" + "─".repeat(72));

  for (const c of CASES) {
    const r = await analyzeCase(supabase, { facts: c.facts });
    const gotLaws    = r.laws.map((l) => l.articleNumber ?? "?");
    const gotDiscuss = r.discuss?.length ?? 0;
    const lawsOk     = JSON.stringify(gotLaws) === JSON.stringify(c.expectedLaws);
    const discussOk  = gotDiscuss === c.expectedDiscussCount;
    const ok         = lawsOk && discussOk;
    if (!ok) allPassed = false;

    console.log(`${ok ? "✓" : "✗"} [${c.id}] ${c.note}`);
    if (!lawsOk) {
      console.log(`  laws expected: [${c.expectedLaws.join(",")}]`);
      console.log(`  laws got:      [${gotLaws.join(",")}]`);
    }
    if (!discussOk) {
      console.log(`  discuss expected: ${c.expectedDiscussCount}`);
      console.log(`  discuss got:      ${gotDiscuss}`);
    }
  }

  console.log("─".repeat(72));
  console.log(allPassed ? "ALL PASSED" : "FAILURES");
  process.exit(allPassed ? 0 : 1);
}

main();
