/**
 * Runs batch15 facts through analyzeCase and prints id | laws | discuss keys.
 * Run: npx tsx lib/case-mapper/__tests__/_run-batch15.ts
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";
import { readFileSync } from "fs";
import path from "path";

try { (process as any).loadEnvFile(".env.local"); } catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const TESTS_DIR = path.join(process.cwd(), "lib/case-mapper/__tests__");
const facts = JSON.parse(
  readFileSync(path.join(TESTS_DIR, "batch15.json"), "utf8")
) as { id: string; facts: string }[];

async function main() {
  for (const f of facts) {
    const r = await analyzeCase(supabase, { facts: f.facts });
    const laws = r.laws.map((l: any) => l.articleNumber ?? "?").join(",") || "—";
    const discuss = (r.discuss ?? []).map((d: any) => d.concept ?? "?").join(",") || "—";
    console.log(`${f.id}\t${laws}\t${discuss}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
