// End-to-end check of Abu Rannat (analyzeCase) on the 30 approved cases.
// For each case: path taken, articles shown (laws + open-point cards), and whether
// an approved article is among them. Prints article numbers only.
// Run: npx -y tsx scripts/eval-analyze-30.ts        (all)
//      npx -y tsx scripts/eval-analyze-30.ts 19     (one case, more detail)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../lib/case-mapper/analyze";

try { (process as any).loadEnvFile(".env.local"); } catch {}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
type Case = { n: number; facts: string; gold: Record<string, string[]> | null; note?: string };
const cases: Case[] = JSON.parse(readFileSync("scripts/abu-rannat-30.json", "utf8"));
const only = process.argv[2] ? Number(process.argv[2]) : null;
const short = (s: string | null) => (s ?? "?").split("-")[0];

async function main() {
let measured = 0, hit = 0;
for (const c of cases) {
  if (only && c.n !== only) continue;
  const r = await analyzeCase(supabase, { facts: c.facts });
  const path = r.issues[0]?.term === "بحث بالمعنى في متن مكوريا" ? "معنى" : r.laws.length ? "نصي/جنائي" : "—";
  const shown = [...r.laws, ...(r.discuss ?? []).flatMap((d) => d.articles)];
  const ok = c.gold ? shown.some((a) => {
    const g = c.gold![a.lawSlug ?? ""]; return !!g && (g.includes("*") || g.includes(String(a.articleNumber)));
  }) : null;
  if (ok !== null) { measured++; if (ok) hit++; }
  const list = r.laws.map((a) => `${short(a.lawSlug)} م${a.articleNumber}`).join(" · ") || "لا مواد";
  const cards = (r.discuss ?? []).map((d) => d.articles.map((a) => `م${a.articleNumber}`).join("/")).filter(Boolean).join(" + ");
  console.log(`#${String(c.n).padStart(2)} ${ok === null ? "–" : ok ? "✓" : "✗"} [${path}] ${list}${cards ? `  | بطاقات: ${cards}` : ""}`);
}
if (!only) console.log(`\nالمادة الصحيحة ظاهرة في ${hit} من ${measured} (${Math.round((100 * hit) / measured)}%)`);
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
