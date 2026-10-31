// Measure semantic search on the 30 approved cases: is a correct article in the top 5?
// Run: node scripts/eval-semantic.mjs            (all cases)
//      node scripts/eval-semantic.mjs --case 19  (one case, shows the top 10)
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const cases = JSON.parse(readFileSync(new URL("./abu-rannat-30.json", import.meta.url), "utf8"));
const ci = process.argv.indexOf("--case");
const only = ci > 0 ? Number(process.argv[ci + 1]) : null;
const TOP = 5;

async function embed(text) {
  const r = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text], model: "voyage-4", input_type: "query", output_dimension: 1024 }),
  });
  if (!r.ok) throw new Error(`Voyage ${r.status}: ${await r.text()}`);
  return (await r.json()).data[0].embedding;
}
async function match(vec, n) {
  const r = await fetch(`${SB}/rest/v1/rpc/match_articles`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_embedding: `[${vec.join(",")}]`, p_count: n }),
  });
  if (!r.ok) throw new Error(`match_articles ${r.status}: ${await r.text()}`);
  return r.json();
}
const isGold = (g, row) => !!g?.[row.law_slug] && (g[row.law_slug].includes("*") || g[row.law_slug].includes(String(row.article_number)));

let measured = 0, hits = 0;
for (const c of cases) {
  if (only && c.n !== only) continue;
  if (!c.gold) { console.log(`#${c.n}  —  skipped (${c.note})`); continue; }
  const rows = await match(await embed(c.facts), only ? 10 : TOP);
  const rank = rows.findIndex((r) => isGold(c.gold, r));
  const hit = rank >= 0 && rank < TOP;
  measured++; if (hit) hits++;
  const top = rows.slice(0, only ? 10 : 3).map((r) => `${r.law_slug.split("-")[0]} م${r.article_number}`).join(" · ");
  console.log(`#${String(c.n).padStart(2)}  ${hit ? "✓" : "✗"}  ${hit ? `rank ${rank + 1}` : "      "}  ${top}`);
}
if (!only) console.log(`\nTop-${TOP} hit rate: ${hits}/${measured} = ${Math.round((100 * hits) / measured)}%  (acceptance gate: 80%)`);
