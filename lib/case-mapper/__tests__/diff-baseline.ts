/**
 * Diff current analyzeCase output against .claude/after-c11.json baseline.
 * Run: npx tsx lib/case-mapper/__tests__/diff-baseline.ts
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";
import baseline from "./baseline-after-c11.json";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

type Entry = {
  suite: string;
  id: string | number;
  facts: string;
  laws: { articleNumber: string }[];
  discuss: { label: string }[];
};

async function main() {
  const entries = (baseline as { entries: Entry[] }).entries;
  const changes: string[] = [];
  let checked = 0;

  for (const e of entries) {
    const r = await analyzeCase(supabase, { facts: e.facts });
    const gotLaws   = r.laws.map((l) => l.articleNumber ?? "?");
    const baseLaws  = e.laws.map((l) => l.articleNumber);
    const gotDiscuss  = r.discuss?.length ?? 0;
    const baseDiscuss = e.discuss.length;

    const lawChange     = JSON.stringify(gotLaws) !== JSON.stringify(baseLaws);
    const discussChange = gotDiscuss !== baseDiscuss;

    if (lawChange || discussChange) {
      changes.push(`[${e.suite}/${e.id}]`);
      if (lawChange)     changes.push(`  laws    was [${baseLaws.join(",")}]  got [${gotLaws.join(",")}]`);
      if (discussChange) changes.push(`  discuss was ${baseDiscuss}  got ${gotDiscuss}`);
    }
    checked++;
  }

  console.log(`Checked ${checked} cases against after-c11.json baseline`);
  if (changes.length === 0) {
    console.log("No changes — output identical to baseline");
  } else {
    console.log("CHANGES DETECTED:\n" + changes.join("\n"));
  }
}

main();
