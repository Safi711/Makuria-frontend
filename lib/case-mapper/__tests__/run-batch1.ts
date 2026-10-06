/**
 * Batch scorecard runner.
 * Usage: npx tsx lib/case-mapper/__tests__/run-batch1.ts [batch-number]
 *   batch-number: 1-9 load from the approved batches file; 10 loads batch10.json.
 *
 * Keys are loaded from .env.local (gitignored). Required variables:
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — Supabase anon JWT
 *   ANTHROPIC_API_KEY              — read by analyzeCase via process.env
 *
 * Scoring per S1 spec:
 *   PASS (1.0)  — rank-1 article in expected_articles (same law)
 *   HALF (0.5)  — rank-1 in also_acceptable (and NOT in must_not), OR expected below rank-1
 *   FAIL (0.0)  — must_not article at rank-1 (overrides also_acceptable), or nothing returned
 *   ABSTAIN     — must_abstain_or_clarify=true: PASS iff noConfidentMatch=true
 *   UNSCORED    — expected_articles=[] AND must_discuss present: print, skip
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";
import type { CaseMapResult } from "../analyze";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local so keys never appear on the command line.
// process.loadEnvFile is available in Node ≥ 20.6.
try {
  (process as any).loadEnvFile(".env.local");
} catch {
  // .env.local is optional when env vars are already set (e.g. in CI).
}

const SUPABASE_URL      = "https://damzdxcutawghksuzoan.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!SUPABASE_ANON_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add it to .env.local.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
  process.exit(1);
}
const BATCH_NUMBER = parseInt(process.argv[2] ?? "1", 10);

let batch1: any[];
if (BATCH_NUMBER === 10) {
  const b10 = JSON.parse(
    readFileSync(join(process.cwd(), "lib/case-mapper/__tests__/batch10.json"), "utf8")
  );
  batch1 = b10.tests as any[];
} else {
  const raw = JSON.parse(
    readFileSync("/Users/maibadi/Downloads/Makuria Stage1 Batches01-09 APPROVED ALL.json", "utf8")
  );
  const batchEntry = raw.batches[BATCH_NUMBER - 1];
  if (!batchEntry) {
    console.error(`Batch ${BATCH_NUMBER} not found (file has ${raw.batches.length} batches)`);
    process.exit(1);
  }
  batch1 = batchEntry.tests as any[];
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Extract bare article numbers from must_not strings like "خيانة الأمانة (177)". */
function parseMustNotArts(arr: string[]): Set<string> {
  const s = new Set<string>();
  for (const str of arr) {
    const m = str.match(/\((\d+)\)/g);
    if (m) m.forEach((x) => s.add(x.replace(/[()]/g, "")));
  }
  return s;
}

function rank1Art(result: CaseMapResult): { art: string; slug: string } | null {
  if (!result.laws.length) return null;
  return { art: result.laws[0].articleNumber ?? "", slug: result.laws[0].lawSlug ?? "" };
}

function artInResults(result: CaseMapResult, art: string, slug: string): number {
  return result.laws.findIndex((l) => l.articleNumber === art && l.lawSlug === slug);
}

type ScoreLabel = "PASS" | "HALF" | "FAIL" | "UNSCORED" | "ABSTAIN_PASS" | "ABSTAIN_FAIL";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type Outcome = {
  id: string;
  difficulty: string;
  concept: string;
  score: number | null;
  label: ScoreLabel;
  rank1: string;
  note: string;
};

async function main() {
const outcomes: Outcome[] = [];
let totalScore = 0;
let scoredCount = 0;

console.log(`Running batch ${BATCH_NUMBER} (${batch1.length} cases)…\n`);
console.log("─".repeat(100));

for (const t of batch1) {
  const {
    id, difficulty, facts,
    expected_concept: concept,
    expected_law, expected_articles,
    also_acceptable = [],
    must_not = [],
    must_abstain_or_clarify = false,
    must_discuss,
  } = t;

  const expSlug = expected_law?.slug ?? null;
  const expArts  = (expected_articles as string[]).map(String);
  const alsoArts = (also_acceptable as any[]).map((a: any) => String(a.article));
  const mustNotArts = parseMustNotArts(must_not as string[]);

  // Intent-gated: possession narcotics where Art. 15 / 20 must be discussed but
  // neither is applicable without stated intent — always FAIL until intent-flag
  // feature exists.
  const isIntentGated = expArts.length === 0
    && must_discuss != null
    && (must_discuss as any[]).some((d: any) =>
        Array.isArray(d.articles) &&
        (d.articles.includes("15") || d.articles.includes("20"))
      )
    && !must_abstain_or_clarify;

  // Unscored: empty expected_articles + must_discuss present (non-intent-gated only)
  const isUnscored = expArts.length === 0 && must_discuss != null && !must_abstain_or_clarify && !isIntentGated;

  let result: CaseMapResult;
  try {
    result = await analyzeCase(supabase, { facts });
  } catch (err: any) {
    const o: Outcome = { id, difficulty, concept, score: 0, label: "FAIL", rank1: "ERR", note: String(err?.message ?? err) };
    outcomes.push(o);
    console.log(`${id} [FAIL  ] ERROR: ${o.note}`);
    continue;
  }

  const r1 = rank1Art(result);
  const r1Str = r1 ? `${r1.slug?.split("-").slice(-1)[0]}/${r1.art}` : "—";

  let label: ScoreLabel;
  let score: number | null;
  let note = "";

  if (isIntentGated) {
    const NARCOTICS = "narcotics-psychotropic-substances-act-1994";
    const art15inLaws = result.laws.some(
      (l) => l.lawSlug === NARCOTICS && l.articleNumber === "15"
    );
    const art20inLaws = result.laws.some(
      (l) => l.lawSlug === NARCOTICS && l.articleNumber === "20"
    );
    const art15inDisc = (result.discuss ?? []).some((d) =>
      d.articles.some((a) => a.lawSlug === NARCOTICS && a.articleNumber === "15")
    );
    const art20inDisc = (result.discuss ?? []).some((d) =>
      d.articles.some((a) => a.lawSlug === NARCOTICS && a.articleNumber === "20")
    );
    const intentFlagged = result.intentUnknown === true;
    const passed = intentFlagged && !art15inLaws && !art20inLaws && art15inDisc && art20inDisc;

    label = passed ? "PASS" : "FAIL";
    score = passed ? 1 : 0;
    if (passed) {
      note = "intentUnknown=true; Art.15/20 in discuss, not in laws ✓";
    } else {
      const lawsBrief = result.laws.slice(0, 4)
        .map((l) => `${l.lawSlug?.split("-").slice(-1)[0]}/${l.articleNumber}`)
        .join(", ");
      const problems: string[] = [];
      if (!intentFlagged) problems.push("intentUnknown not set");
      if (art15inLaws)    problems.push("Art.15 in laws");
      if (art20inLaws)    problems.push("Art.20 in laws");
      if (!art15inDisc)   problems.push("Art.15 missing from discuss");
      if (!art20inDisc)   problems.push("Art.20 missing from discuss");
      note = `${problems.join("; ")}  laws=[${lawsBrief || "—"}]`;
    }

  } else if (must_abstain_or_clarify) {
    if (result.noConfidentMatch) {
      label = "ABSTAIN_PASS"; score = 1; note = "noConfidentMatch=true ✓";
    } else {
      label = "ABSTAIN_FAIL"; score = 0;
      note = `returned articles when should abstain; rank-1=${r1Str}`;
    }

  } else if (isUnscored) {
    label = "UNSCORED"; score = null;
    const lawsBrief = result.laws.slice(0,4)
      .map((l) => `${l.lawSlug?.split("-").slice(-1)[0]}/${l.articleNumber}`)
      .join(", ");
    note = `noConf=${result.noConfidentMatch}  laws=[${lawsBrief || "—"}]`;

  } else if (!r1 || result.noConfidentMatch) {
    // Nothing returned
    label = "FAIL"; score = 0;
    note = result.noConfidentMatch ? "noConfidentMatch" : "no laws returned";

  } else {
    // Check in order: must_not → pass → half-also → half-below → fail
    const r1InExpected   = expSlug === r1.slug && expArts.includes(r1.art);
    const r1InAlso       = expSlug === r1.slug && alsoArts.includes(r1.art);
    const r1InMustNot    = mustNotArts.has(r1.art); // must_not at rank-1 is always FAIL, even if also in also_acceptable

    if (r1InMustNot) {
      label = "FAIL"; score = 0;
      note = `must_not at rank-1: ${r1Str}`;
    } else if (r1InExpected) {
      label = "PASS"; score = 1;
      note = expArts.length > 1 ? `rank-1=${r1Str} (one of ${expArts.join("/")})` : "";
    } else if (r1InAlso) {
      label = "HALF"; score = 0.5;
      note = `rank-1=${r1Str} in also_acceptable`;
    } else {
      // Check if expected appears below rank-1
      const expFoundBelow = expArts.find((a) => artInResults(result, a, expSlug ?? "") > 0);
      if (expFoundBelow) {
        const idx = artInResults(result, expFoundBelow, expSlug ?? "");
        label = "HALF"; score = 0.5;
        note = `rank-1=${r1Str}; expected Art.${expFoundBelow} found at rank ${idx + 1}`;
      } else {
        label = "FAIL"; score = 0;
        const lawsBrief = result.laws.slice(0, 3)
          .map((l) => `${l.lawSlug?.split("-").slice(-1)[0]}/${l.articleNumber}`)
          .join(", ");
        note = `wrong article; laws=[${lawsBrief}]`;
      }
    }
  }

  if (score !== null) {
    totalScore += score;
    scoredCount++;
  }

  const tag = label === "PASS" || label === "ABSTAIN_PASS" ? "PASS  "
            : label === "HALF"                             ? "HALF  "
            : label === "FAIL" || label === "ABSTAIN_FAIL" ? "FAIL  "
            : "SKIP  ";

  console.log(
    `${id} [${tag}] ${difficulty.padEnd(18)} ${concept.padEnd(22)} ${note}`
  );

  outcomes.push({ id, difficulty, concept, score, label, rank1: r1Str, note });
}

// ── Scorecard ────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(100));
console.log(`BATCH ${BATCH_NUMBER} SCORECARD`);
console.log("═".repeat(100));
const unscoredCount = outcomes.filter(o => o.label === "UNSCORED").length;
console.log(`\nScore: ${totalScore}/${scoredCount}  (target ≥ 9.0)${unscoredCount ? `  [${unscoredCount} case(s) unscored: must_discuss]` : ""}`);
console.log(`Passes: ${outcomes.filter(o => o.label === "PASS" || o.label === "ABSTAIN_PASS").length}`);
console.log(`Halves: ${outcomes.filter(o => o.label === "HALF").length}`);
console.log(`Fails:  ${outcomes.filter(o => o.label === "FAIL" || o.label === "ABSTAIN_FAIL").length}`);

const unscored = outcomes.filter(o => o.label === "UNSCORED");
if (unscored.length) {
  console.log(`\nUnscored (must_discuss):`);
  for (const u of unscored) {
    console.log(`  ${u.id}  ${u.concept}  →  ${u.note}`);
  }
}
console.log("");
} // end main

main().catch((err) => { console.error(err); process.exit(1); });
