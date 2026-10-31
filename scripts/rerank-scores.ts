// Rerank scores of the top 10 semantic hits for the non-criminal approved cases.
// Marks approved articles with ✓ so a relevance cut-off can be chosen from data.
// Run: npx -y tsx scripts/rerank-scores.ts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { semanticSearch } from "../lib/case-mapper/semantic-search";

try { (process as any).loadEnvFile(".env.local"); } catch {}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
type Case = { n: number; facts: string; gold: Record<string, string[]> | null };
const cases: Case[] = JSON.parse(readFileSync("scripts/abu-rannat-30.json", "utf8"));
const NON_CRIMINAL = new Set([11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,28]);

async function main() {
  const gold: number[] = [], other: number[] = [];
  for (const c of cases) {
    if (!NON_CRIMINAL.has(c.n) || !c.gold) continue;
    const r = await semanticSearch(supabase, c.facts, 10);
    if (!r) { console.log(`#${c.n} — no result`); continue; }
    const cells = r.hits.map((h) => {
      const g = c.gold![h.lawSlug]; const ok = !!g && (g.includes("*") || g.includes(String(h.articleNumber)));
      (ok ? gold : other).push(h.rerankScore);
      return `${ok ? "✓" : " "}${h.rerankScore.toFixed(2)}`;
    });
    console.log(`#${String(c.n).padStart(2)}  ${cells.join(" ")}`);
  }
  const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]?.toFixed(2); };
  console.log(`\napproved: min ${q(gold,0)} p10 ${q(gold,0.1)} median ${q(gold,0.5)}`);
  console.log(`other:    p50 ${q(other,0.5)} p75 ${q(other,0.75)} p90 ${q(other,0.9)}`);
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
