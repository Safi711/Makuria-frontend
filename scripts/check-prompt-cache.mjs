// Check that the classifier's instructions are long enough to be cached, and that
// the cache is actually hit on a repeat call. Prints token counts only.
// Run: node scripts/check-prompt-cache.mjs
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const src = readFileSync(new URL("../lib/case-mapper/llm-classifier.ts", import.meta.url), "utf8");
const i = src.indexOf("const SYSTEM_PROMPT = `");
const system = src.slice(i + 23, src.indexOf("`;", i));
const H = { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" };
const MODEL = "claude-haiku-4-5-20251001";

const c = await (await fetch("https://api.anthropic.com/v1/messages/count_tokens", { method: "POST", headers: H,
  body: JSON.stringify({ model: MODEL, system, messages: [{ role: "user", content: "x" }] }) })).json();
console.log(`System prompt tokens: ${c.input_tokens} (Haiku 4.5 caches from 4,096)`);

for (const n of [1, 2]) {
  const r = await (await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: H,
    body: JSON.stringify({ model: MODEL, max_tokens: 64, temperature: 0,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "الوقائع:\nامرأة سرقت هاتفًا من شنطة امرأة أخرى في السوق" }] }) })).json();
  const u = r.usage ?? {};
  console.log(`Call ${n}: input=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`);
}
