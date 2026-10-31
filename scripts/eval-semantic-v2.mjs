// Compare four retrieval settings on the 30 approved cases (correct article in the top 5):
//   A plain      — embed the facts as written
//   B rewrite    — a model first restates the facts as a short formal legal description
//   C rerank     — A, then Voyage rerank-2.5 reorders the top 40
//   D both       — B, then rerank
// Repealed articles and cyber-crimes-2007 are excluded (match_articles_v2).
// Run: node scripts/eval-semantic-v2.mjs     |   node scripts/eval-semantic-v2.mjs --case 8
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
const TOP = 5, POOL = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, headers, body) {
  for (let a = 0; ; a++) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && a < 5) { await sleep(3000 * 2 ** a); continue; }
    throw new Error(`${url} ${r.status}: ${await r.text()}`);
  }
}
const voyageH = { Authorization: `Bearer ${env.VOYAGE_API_KEY}` };
const embed = async (t) => (await post("https://api.voyageai.com/v1/embeddings", voyageH,
  { input: [t], model: "voyage-4", input_type: "query", output_dimension: 1024 })).data[0].embedding;
const match = (vec) => post(`${SB}/rest/v1/rpc/match_articles_v2`, { apikey: ANON, Authorization: `Bearer ${ANON}` },
  { p_embedding: `[${vec.join(",")}]`, p_count: POOL });
async function rerank(query, rows) {
  const docs = rows.map((r) => `${r.law_title} — المادة ${r.article_number}${r.title_ar ? ` (${r.title_ar})` : ""}\n${r.content_ar}`);
  const j = await post("https://api.voyageai.com/v1/rerank", voyageH, { query, documents: docs, model: "rerank-2.5", top_k: rows.length });
  return j.data.map((d) => rows[d.index]);
}
const REWRITE_SYS = `أنت مساعد بحث قانوني في التشريع السوداني. تصلك وقائع كما يرويها شخص عادي، وقد تكون بالعامية السودانية.
أعد صياغتها في جملتين أو ثلاث بالعربية الفصحى القانونية، تصف: نوع العلاقة أو الفعل، والمسألة القانونية المطروحة، وفرع القانون الأقرب (جنائي، معاملات مدنية، إيجار مباني، عمل، مرور، خدمة مدنية، حكم محلي...).
لا تذكر أرقام مواد، ولا تحكم بثبوت شيء، ولا تضف وقائع غير موجودة. أخرج الصياغة فقط.`;
async function rewrite(facts) {
  const j = await post("https://api.anthropic.com/v1/messages",
    { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    { model: "claude-haiku-4-5", max_tokens: 300, system: REWRITE_SYS, messages: [{ role: "user", content: facts }] });
  return j.content.map((c) => c.text ?? "").join("").trim();
}
const isGold = (g, r) => !!g?.[r.law_slug] && (g[r.law_slug].includes("*") || g[r.law_slug].includes(String(r.article_number)));
const rankOf = (g, rows) => rows.findIndex((r) => isGold(g, r));
const short = (r) => `${r.law_slug.split("-")[0]} م${r.article_number}`;

const tot = { A: 0, B: 0, C: 0, D: 0 }; let measured = 0;
console.log("#    A plain   B rewrite  C rerank   D both");
for (const c of cases) {
  if (only && c.n !== only) continue;
  if (!c.gold) { console.log(`#${c.n}  skipped — ${c.note}`); continue; }
  const rw = await rewrite(c.facts);
  const qB = `${rw}\n${c.facts}`;
  const poolA = await match(await embed(c.facts));
  const poolB = await match(await embed(qB));
  const res = { A: poolA, B: poolB, C: await rerank(c.facts, poolA), D: await rerank(qB, poolB) };
  measured++;
  const cells = ["A", "B", "C", "D"].map((k) => {
    const rk = rankOf(c.gold, res[k]); const hit = rk >= 0 && rk < TOP; if (hit) tot[k]++;
    return (hit ? `✓ ${rk + 1}` : rk >= 0 ? `✗ (${rk + 1})` : "✗ —").padEnd(10);
  });
  console.log(`#${String(c.n).padStart(2)}  ${cells.join(" ")}`);
  if (only) {
    console.log(`\nRewrite: ${rw}\n`);
    for (const k of ["A", "D"]) console.log(`${k} top 10: ${res[k].slice(0, 10).map(short).join(" · ")}`);
  }
}
if (!only) {
  console.log("\nTop-5 hit rate (gate 80%):");
  for (const k of ["A", "B", "C", "D"]) console.log(`  ${k}: ${tot[k]}/${measured} = ${Math.round((100 * tot[k]) / measured)}%`);
}
