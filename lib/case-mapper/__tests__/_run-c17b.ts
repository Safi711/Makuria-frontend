/**
 * Commit 17b — held-out tests: clean prompt examples + general death rule.
 * 3 runs each, all must agree.
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const RUNS = 3;

function laws(r: any) { return r.laws.map((l: any) => l.articleNumber).join(","); }
function card(r: any) { return r.discuss?.some((d: any) => d.concept === "قتل:وصف") ? "CARD" : "no card"; }
function hasDiscuss(r: any) { return (r.discuss?.length ?? 0) > 0 ? `discuss:[${r.discuss.map((d: any) => d.concept).join("|")}]` : "discuss:(none)"; }

async function runOnce(facts: string) {
  const r = await analyzeCase(supabase, { facts });
  return { l: laws(r), c: card(r), d: hasDiscuss(r), raw: r };
}

async function run3(facts: string) {
  const runs: { l: string; c: string; d: string; raw: any }[] = [];
  for (let i = 0; i < RUNS; i++) runs.push(await runOnce(facts));
  return runs;
}

function agree3(runs: { l: string; c: string }[]) {
  return runs.every(r => r.l === runs[0].l && r.c === runs[0].c);
}

async function main() {
  console.log("Commit 17b — held-out tests\n" + "─".repeat(72));

  // ── Open point (expect 129 CARD, all agree) ──────────────────────────────
  console.log("\n── Open point (expect laws:129 CARD) ──");
  const openCases = [
    { id: "H1", facts: "لكم المتهم المجني عليه في وجهه فسقط على الرصيف ومات، وقال إنه لم يقصد قتله." },
    { id: "H2", facts: "دفع المتهم جاره من على السلم أثناء مشادة فتوفي متأثراً بإصابته، وأنكر نية القتل." },
  ];
  for (const c of openCases) {
    const runs = await run3(c.facts);
    const ok = agree3(runs) && runs[0].l === "129" && runs[0].c === "CARD";
    console.log(`${ok ? "✓" : "✗"} [${c.id}] ${runs.map(r => `laws:[${r.l}] ${r.c}`).join(" | ")}`);
    if (!agree3(runs)) console.log("  ⚠ runs disagree");
  }

  // ── Art. 130, no card (lethal weapon: denial must not affect laws) ────────
  console.log("\n── Art. 130 no card (expect laws:130,129 or 131,129 — no قتل:وصف card) ──");
  const art130Cases = [
    { id: "K1", facts: "طعن المتهم المجني عليه بسكين في صدره فتوفي، ونفى أنه أراد قتله." },
    { id: "K2", facts: "أطلق المتهم النار على المجني عليه فأرداه قتيلاً، وأنكر قصد القتل." },
  ];
  for (const c of art130Cases) {
    const runs = await run3(c.facts);
    const noCard = runs.every(r => r.c === "no card");
    const lawsOk = runs[0].l === "130,129" || runs[0].l === "131,129";
    const ok = noCard && lawsOk;
    console.log(`${ok ? "✓" : "✗"} [${c.id}] ${runs.map(r => `laws:[${r.l}] ${r.c}`).join(" | ")}`);
    if (runs[0].l !== "130,129" && runs[0].l !== "131,129") {
      console.log(`  ⚠ NOTE: expected 130,129 or 131,129 — got ${runs[0].l}. Report and stop.`);
    }
  }

  // ── Stays wound ───────────────────────────────────────────────────────────
  console.log("\n── Stays wound ──");
  const woundCases = [
    { id: "W1", facts: "ضربه بعصا فجرحه، ثم مات المجني عليه بعد أسابيع بالملاريا.", expect: "139,138 no card" },
    { id: "W2", facts: "طعنه بمطوة في فخذه فنزف ونُقل إلى المستشفى وخرج بعد أسبوع.", expect: "139,138 + card" },
  ];
  for (const c of woundCases) {
    const runs = await run3(c.facts);
    const lawsGot = runs[0].l;
    const discGot = runs[0].d;
    const lawsOk = lawsGot === "139,138";
    const expectsCard = c.expect.includes("+ card");
    const cardOk = expectsCard ? discGot !== "discuss:(none)" : discGot === "discuss:(none)";
    const ok = lawsOk && cardOk && agree3(runs);
    console.log(`${ok ? "✓" : "✗"} [${c.id}] laws:[${lawsGot}] ${discGot} — expect ${c.expect}`);
    if (!agree3(runs)) console.log("  ⚠ runs disagree");
  }

  // ── Re-run original negation rows O1-O4 ─────────────────────────────────
  console.log("\n── Re-run O1-O4 (expect laws:129 CARD) ──");
  const origCases = [
    { id: "O1", facts: "ضرب المتهم المجني عليه بعصا على رأسه دون قصد قتله فتوفي." },
    { id: "O2", facts: "ضربه بعصا على رأسه ولم يكن ذلك بقصد قتله فتوفي." },
    { id: "O3", facts: "ضربه بعصا فتوفي، ونفى المتهم أنه أراد قتله." },
    { id: "O4", facts: "ضربه بعصا فتوفي، وأنكر المتهم أنه كان قاصداً قتله." },
  ];
  for (const c of origCases) {
    const runs = await run3(c.facts);
    const ok = agree3(runs) && runs[0].l === "129" && runs[0].c === "CARD";
    console.log(`${ok ? "✓" : "✗"} [${c.id}] ${runs.map(r => `laws:[${r.l}] ${r.c}`).join(" | ")}`);
  }

  // ── Re-run G9 / G10 ────────────────────────────────────────────────────
  console.log("\n── G9 / G10 (must stay) ──");
  const gCases = [
    { id: "G9",  facts: "انشغل سائق بهاتفه ولم ينتبه للطريق، فصدم أحد المشاة وتسبب في وفاته، دون قصد الاعتداء عليه.", expect: "132" },
    { id: "G10", facts: "ضرب شخص آخر بسكين عمدًا، فأحدث جرحًا قطعيًا مثبتًا طبيًا، دون وفاته.", expect: "139,138 no discuss" },
  ];
  for (const c of gCases) {
    const runs = await run3(c.facts);
    const g10expect = c.expect === "139,138 no discuss";
    const lawsOk = g10expect ? runs[0].l === "139,138" : runs[0].l === c.expect;
    const discOk = !g10expect || runs[0].d === "discuss:(none)";
    const ok = lawsOk && discOk && agree3(runs);
    console.log(`${ok ? "✓" : "✗"} [${c.id}] laws:[${runs[0].l}] ${runs[0].d} — expect ${c.expect}`);
  }
}

main();
