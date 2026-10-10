/**
 * Batch 11 — unseen qualification batch (measurement only).
 * Runs 10 lawyer-written cases 3 times each through analyzeCase.
 * Scores STRICT and CORE; diagnoses failures; flags instability.
 *
 * Run: npx tsx lib/case-mapper/__tests__/_run-batch11.ts
 *
 * STRICT = firstArticle === primary
 *        AND discussCards (excl. participation) equals CARDS (شروع:* wildcard)
 *        AND no article outside {primary ∪ allowed} in classification
 *        AND negationNote matches if specified
 *        AND RELATED met where listed
 *        AND mustNotHave articles absent
 *
 * CORE   = firstArticle === primary
 *        AND no article outside {primary ∪ allowed} in classification
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";
import * as fs from "fs";
import * as path from "path";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const RUNS = 3;

// ── Types ──────────────────────────────────────────────────────────────────────

interface CaseExpected {
  primary: string;         // expected first article number
  allowed: string[];       // additional articles allowed beyond primary
  cards: string[];         // expected discuss card concept keys; "شروع:*" = any attempt card
  cardsNew: string[];      // subset of cards that are NEW (expected to fail; diagnosis only)
  negationNote: boolean | null;  // null = don't check
  relatedNew: boolean;     // RELATED requirement is NEW feature → always fails STRICT
  mustNotHave: string[];   // article numbers that must NOT appear in classification
}

interface BatchCase {
  id: string;
  title: string;
  facts: string;
  expected: CaseExpected;
}

interface RunResult {
  effectiveTerm: string;
  articles: string[];
  cardKeys: string[];
  hasNegNote: boolean;
  attemptEvidence: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isParticipationCard(concept: string): boolean {
  // Participation open-point concepts (Arts. 21/22) — excluded from STRICT/CORE scoring.
  // The engine does not implement these yet; guard is here for future-proofing.
  return concept.startsWith("اشتراك") || concept.startsWith("مشاركة");
}

/** Returns true when engine's card set (after شروع:* wildcard expansion) equals expected. */
function cardsMatch(engine: string[], expected: string[]): boolean {
  if (engine.length !== expected.length) return false;
  const remaining = [...engine];
  for (const exp of expected) {
    const idx =
      exp === "شروع:*"
        ? remaining.findIndex((e) => e.startsWith("شروع:"))
        : remaining.indexOf(exp);
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

interface ScoreResult {
  pass: boolean;
  reasons: string[];
}

function scoreStrict(r: RunResult, exp: CaseExpected): ScoreResult {
  const reasons: string[] = [];
  const allowed = new Set([exp.primary, ...exp.allowed]);

  if (r.articles[0] !== exp.primary)
    reasons.push(`first article: expected ${exp.primary} got ${r.articles[0] ?? "—"}`);

  if (!cardsMatch(r.cardKeys, exp.cards))
    reasons.push(`cards: expected [${exp.cards.join(", ")}] got [${r.cardKeys.join(", ") || "—"}]`);

  const outside = r.articles.filter((a) => !allowed.has(a));
  if (outside.length > 0)
    reasons.push(`outside allowed: [${outside.join(", ")}]`);

  if (exp.negationNote !== null && r.hasNegNote !== exp.negationNote)
    reasons.push(`negation note: expected ${exp.negationNote} got ${r.hasNegNote}`);

  if (exp.relatedNew)
    reasons.push("RELATED traffic-law-2010: NEW feature, not implemented");

  const illegal = r.articles.filter((a) => exp.mustNotHave.includes(a));
  if (illegal.length > 0)
    reasons.push(`mustNotHave violated: [${illegal.join(", ")}]`);

  return { pass: reasons.length === 0, reasons };
}

function scoreCore(r: RunResult, exp: CaseExpected): ScoreResult {
  const reasons: string[] = [];
  const allowed = new Set([exp.primary, ...exp.allowed]);

  if (r.articles[0] !== exp.primary)
    reasons.push(`first article: expected ${exp.primary} got ${r.articles[0] ?? "—"}`);

  const outside = r.articles.filter((a) => !allowed.has(a));
  if (outside.length > 0)
    reasons.push(`outside allowed: [${outside.join(", ")}]`);

  return { pass: reasons.length === 0, reasons };
}

/** Returns a one-line diagnosis for cases that fail, based on code analysis. */
function diagnose(caseId: string, r: RunResult, exp: CaseExpected, strict: ScoreResult, core: ScoreResult): string {
  if (strict.pass && core.pass) return "";
  switch (caseId) {
    case "B11-03":
      return "gate did not fire — factsNegateIntentToKill INTENT_ROOTS=[قصد/يقصد]; يريد not recognized → narrator negation undetected → engine uses weapon concept → [130,129]";
    case "B11-05":
      return "feature does not exist — traffic-law-2010 related-legislation panel not implemented";
    case "B11-07":
      return "gate did not fire — \"مادة سامة\" not matched by LETHAL_METHOD_GROUPS[\"سم\"] keywords (السم/سماً/سمّم/تسميم/دسّ السم); Change-1 جرح:وصف gate requires whichLethalMethod ≠ null → engine uses جرح/أذى concept → no method or injury card";
    case "B11-08":
      return "feature does not exist — إصابة:وصف card for fracture without lethal method not implemented; Change-1 gate requires lethal method (خنق/سم/حرق/إغراق); عصا خشبية is not in LETHAL_WEAPON_KW or LETHAL_METHOD_KW";
    case "B11-10":
      return "feature does not exist — hiraba open-point card (Arts. 167/168) and robbery-context attempt card not implemented; weapon gate fires only for LLM concept جرح عمد, not نهب";
    default: {
      const parts: string[] = [];
      if (r.articles[0] !== exp.primary)
        parts.push(`wrong LLM concept or gate → first article ${r.articles[0] ?? "—"} ≠ expected ${exp.primary}`);
      if (!cardsMatch(r.cardKeys, exp.cards))
        parts.push(`card mismatch: got [${r.cardKeys.join(",")||"—"}]`);
      return parts.join("; ") || "diagnosis not pre-mapped — inspect effective term above";
    }
  }
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function runOnce(facts: string): Promise<RunResult> {
  const r = await analyzeCase(supabase, { facts });
  const articles = r.laws.map((l: any) => l.articleNumber ?? "?");
  const allCards: any[] = r.discuss ?? [];
  const scorableCards = allCards.filter((d) => !isParticipationCard(d.concept ?? ""));
  const cardKeys = scorableCards.map((d: any) => d.concept ?? "?");
  const hasNegNote = allCards.some((d: any) => Boolean(d.negationNote));
  const attemptCard = allCards.find((d: any) => (d.concept ?? "").startsWith("شروع:"));
  const attemptEvidence = (attemptCard as any)?.evidenceLine ?? null;
  const effectiveTerm = (r.issues?.[0] as any)?.term ?? (r as any)._debug?.llmConcept ?? "—";
  return { effectiveTerm, articles, cardKeys, hasNegNote, attemptEvidence };
}

function runsConsistent(runs: RunResult[]): boolean {
  const r0 = runs[0];
  return runs.every(
    (r) =>
      r.articles.join(",") === r0.articles.join(",") &&
      r.cardKeys.join(",") === r0.cardKeys.join(",") &&
      r.hasNegNote === r0.hasNegNote
  );
}

async function main() {
  const casesPath = path.join(__dirname, "batch11.json");
  const cases: BatchCase[] = JSON.parse(fs.readFileSync(casesPath, "utf8"));

  console.log("\nBatch 11 — Unseen qualification (measurement only)");
  console.log("3 runs each | STRICT and CORE scored separately");
  console.log("═".repeat(90));

  let strictPassed = 0;
  let corePassed   = 0;
  const total = cases.length;

  for (const c of cases) {
    const runs: RunResult[] = [];
    for (let i = 0; i < RUNS; i++) {
      runs.push(await runOnce(c.facts));
    }

    const stable = runsConsistent(runs);
    const r = runs[0]; // use first run for scoring (all are consistent when stable)

    const strict = scoreStrict(r, c.expected);
    const core   = scoreCore(r, c.expected);

    if (strict.pass) strictPassed++;
    if (core.pass)   corePassed++;

    console.log(`\n${c.id}  ${c.title}${!stable ? "  ⚠ UNSTABLE" : ""}`);
    if (!stable) {
      for (let i = 0; i < RUNS; i++) {
        const ri = runs[i];
        console.log(`  run ${i + 1}: term=${ri.effectiveTerm}  articles=[${ri.articles.join(",")}]  cards=[${ri.cardKeys.join(",") || "—"}]  negNote=${ri.hasNegNote}`);
      }
    } else {
      const negLabel = c.expected.negationNote !== null
        ? (r.hasNegNote ? "present" : "absent")
        : "—";
      const evLabel = r.attemptEvidence ? `«${r.attemptEvidence.slice(0, 40)}…»` : "—";
      console.log(
        `  concept: ${r.effectiveTerm}  |  articles: ${r.articles.join(", ") || "—"}` +
        `  |  cards: ${r.cardKeys.join(", ") || "—"}`
      );
      console.log(`  negation-note: ${negLabel}  |  attempt-evidence: ${evLabel}`);
    }

    const strictLabel = strict.pass ? "✓" : "✗";
    const coreLabel   = core.pass   ? "✓" : "✗";

    if (strict.pass && core.pass) {
      console.log(`  STRICT: ${strictLabel}   CORE: ${coreLabel}`);
    } else {
      if (!strict.pass) {
        const newFlags = c.expected.cardsNew.length > 0 ? `  [NEW: ${c.expected.cardsNew.join(", ")}]` : "";
        console.log(`  STRICT: ${strictLabel}  ← ${strict.reasons.join(" | ")}${newFlags}`);
      } else {
        console.log(`  STRICT: ${strictLabel}`);
      }
      if (!core.pass) {
        console.log(`  CORE:   ${coreLabel}  ← ${core.reasons.join(" | ")}`);
      } else {
        console.log(`  CORE:   ${coreLabel}`);
      }
      const diag = diagnose(c.id, r, c.expected, strict, core);
      if (diag) console.log(`    CAUSE: ${diag}`);
    }
  }

  console.log("\n" + "═".repeat(90));
  console.log(`STRICT  ${strictPassed}/${total}`);
  console.log(`CORE    ${corePassed}/${total}`);
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
