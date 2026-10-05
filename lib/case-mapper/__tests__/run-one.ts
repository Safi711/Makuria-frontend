import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";

try { (process as any).loadEnvFile(".env.local"); } catch {}
const supabase = createClient(
  "https://damzdxcutawghksuzoan.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const facts = process.argv[2] ?? "";

async function main() {
  const r = await analyzeCase(supabase, { facts });
  console.log("noConfidentMatch:", r.noConfidentMatch);
  console.log("intentUnknown   :", r.intentUnknown ?? false);
  console.log("hasAnyResults   :", r.hasAnyResults);
  console.log("\nApplicable articles (laws):");
  if (r.laws.length === 0) {
    console.log("  —");
  } else {
    for (const l of r.laws) {
      console.log(`  [${l.lawSlug}  Art. ${l.articleNumber}]  ${l.lawTitle ?? ""}  —  ${l.title}`);
    }
  }
  if (r.discuss?.length) {
    console.log("\nOpen points for lawyer (discuss):");
    for (const d of r.discuss) {
      console.log(`  ${d.label}`);
      for (const a of d.articles) {
        console.log(`    [${a.lawSlug}  Art. ${a.articleNumber}]  ${a.title}`);
      }
    }
  }
  if (r.caseTypeLens) {
    console.log("\ncaseType:", r.caseTypeLens.categoryNameAr, r.caseTypeLens.inferred ? "(inferred)" : "");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
