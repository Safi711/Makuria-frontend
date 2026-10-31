// Generate Voyage embeddings for every article and store them in article_embeddings.
// Run from the repo root:   node scripts/embed-articles.mjs            (all)
//                           node scripts/embed-articles.mjs --limit 20 (trial run)
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// VOYAGE_API_KEY, EMBED_WRITE_SECRET. Safe to re-run: unchanged articles are skipped.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VOYAGE_API_KEY", "EMBED_WRITE_SECRET"]) {
  if (!env[k]) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const SB = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MODEL = "voyage-4", DIM = 1024, MAX_CHARS = 8000;
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const sbHeaders = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Accounts without a payment method are limited to 3 requests and 10K tokens per
// minute. "--slow" (or detecting that limit) switches to small batches with pauses.
let SLOW = process.argv.includes("--slow");
const batchChars = () => (SLOW ? 14000 : 60000);

async function sbGet(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbRpc(fn, body) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: sbHeaders, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`RPC ${fn} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function voyage(texts) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts, model: MODEL, input_type: "document", output_dimension: DIM }),
    });
    if (r.ok) { const j = await r.json(); return { vecs: j.data.map((d) => d.embedding), tokens: j.usage?.total_tokens ?? 0 }; }
    if (r.status === 429 && !SLOW) {
      const body = await r.text();
      if (/payment method/i.test(body)) {
        SLOW = true;
        console.log("  Voyage free-tier limit (3 requests / 10K tokens per minute) — switching to slow mode: small batches, ~50s apart (about 3 hours for the whole corpus).");
        const err = new Error("RETRY_SMALLER"); err.retrySmaller = true; throw err;
      }
    }
    if ((r.status === 429 || r.status >= 500) && attempt < 8) {
      const wait = Number(r.headers.get("retry-after")) * 1000 || Math.min(60000, 5000 * 2 ** attempt);
      console.log(`  Voyage ${r.status} — waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait); continue;
    }
    throw new Error(`Voyage ${r.status}: ${await r.text()}`);
  }
}

const laws = await sbGet("laws?select=id,title_ar");
const lawTitle = new Map(laws.map((l) => [l.id, l.title_ar ?? ""]));
const articles = [];
for (let off = 0; ; off += 1000) {
  const page = await sbGet(`articles?select=id,law_id,article_number,title_ar,content_ar&order=id&limit=1000&offset=${off}`);
  articles.push(...page);
  if (page.length < 1000) break;
}
const have = new Map((await sbRpc("article_embeddings_hashes", { p_secret: env.EMBED_WRITE_SECRET })).map((h) => [h.article_id, h.content_hash]));

const todo = [];
for (const a of articles) {
  if (!a.content_ar?.trim()) continue;
  const head = `${lawTitle.get(a.law_id) ?? ""} — المادة ${a.article_number ?? ""}${a.title_ar ? ` (${a.title_ar})` : ""}`;
  const text = `${head}\n${a.content_ar}`.slice(0, MAX_CHARS);
  const hash = createHash("sha256").update(`${MODEL}:${DIM}:${text}`).digest("hex");
  if (have.get(a.id) !== hash) todo.push({ id: a.id, text, hash });
  if (todo.length >= LIMIT) break;
}
console.log(`Articles: ${articles.length} · already embedded and unchanged: ${articles.length - todo.length} · to embed now: ${todo.length}`);

let done = 0, tokens = 0;
for (let i = 0; i < todo.length; ) {
  const batch = [];
  let chars = 0;
  const start = i;
  while (i < todo.length && batch.length < 64 && chars + todo[i].text.length <= batchChars()) { chars += todo[i].text.length; batch.push(todo[i++]); }
  if (!batch.length) batch.push(todo[i++]);
  let res;
  try { res = await voyage(batch.map((b) => b.text)); }
  catch (e) { if (e.retrySmaller) { i = start; await sleep(61000); continue; } throw e; }
  const { vecs, tokens: t } = res;
  tokens += t;
  const rows = batch.map((b, k) => ({ article_id: b.id, embedding: `[${vecs[k].join(",")}]`, model: MODEL, content_hash: b.hash }));
  await sbRpc("article_embeddings_upsert", { p_rows: rows, p_secret: env.EMBED_WRITE_SECRET });
  done += batch.length;
  console.log(`  ${done}/${todo.length} embedded (${tokens.toLocaleString()} tokens so far)`);
  if (SLOW && i < todo.length) await sleep(50000);
}
console.log(`Done. ${done} articles embedded, ${tokens.toLocaleString()} Voyage tokens used.`);
