/**
 * Golden-test scorecard — baseline runner.
 * Usage: node lib/case-mapper/__tests__/run-golden.ts <anon-key>
 * Never commit; the anon key must stay out of source.
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeCase } from "../analyze";
import type { CaseMapResult } from "../analyze";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Auth ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://damzdxcutawghksuzoan.supabase.co";
const SUPABASE_ANON_KEY = process.argv[2] ?? "";
if (!SUPABASE_ANON_KEY) {
  console.error("Usage: node lib/case-mapper/__tests__/run-golden.ts <anon-key>");
  process.exit(1);
}

// ── Golden cases ──────────────────────────────────────────────────────────
const golden = JSON.parse(
  readFileSync(join(__dirname, "golden-cases.json"), "utf8")
);
const tests: any[] = golden.tests;

// ── Law-year → slug ───────────────────────────────────────────────────────
const LAW_YEAR_TO_SLUG: Record<number, string> = {
  1991: "criminal-law-1991",
  1994: "narcotics-psychotropic-substances-act-1994",
};

const CRIMINAL_SLUGS = new Set([
  "criminal-law-1991",
  "narcotics-psychotropic-substances-act-1994",
]);

// ── Per-test outcome ───────────────────────────────────────────────────────
type Outcome = {
  id: number;
  category: string;
  action: string;
  passed: boolean | null;  // null = skipped (future feature)
  label: "concept map gap" | "retrieval bug" | "future feature" | null;
  note: string;
  sourceGap: boolean;
  laws0: string;           // rank-1 law slug + article for quick reading
};

// ── Run ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const outcomes: Outcome[] = [];
const conceptMapGapIds: number[] = [];
const retrievalBugIds: number[]  = [];
const sourceGapIds: number[]     = [];
const futureFeatureIds: number[] = [];

console.log("Running 30 golden cases…\n");
console.log("─".repeat(100));

for (const t of tests) {
  const { id, category, input, expected } = t;
  const action: string = expected.action;

  // ── Future feature: skip clarification_required ───────────────────────
  if (expected.clarification_required) {
    futureFeatureIds.push(id);
    outcomes.push({
      id, category, action,
      passed: null, label: "future feature", note: "clarification_required", sourceGap: false, laws0: "—",
    });
    console.log(`T${String(id).padStart(2,"0")} [SKIP ] future_feature    action=${action}`);
    continue;
  }

  let result: CaseMapResult;
  try {
    result = await analyzeCase(supabase, { facts: input });
  } catch (err: any) {
    outcomes.push({
      id, category, action,
      passed: false, label: "retrieval bug", note: `ERROR: ${err?.message ?? err}`, sourceGap: false, laws0: "ERR",
    });
    console.log(`T${String(id).padStart(2,"0")} [ERROR] ${category.padEnd(20)} ${err?.message ?? err}`);
    continue;
  }

  let passed  = false;
  let label:   "concept map gap" | "retrieval bug" | null = null;
  let note     = "";
  let sourceGap = false;
  const laws0  = result.laws.length
    ? `${result.laws[0].lawSlug?.split("-").slice(-1)[0] ?? "?"}/${result.laws[0].articleNumber}`
    : "—";

  // ── action = "match" ────────────────────────────────────────────────────
  if (action === "match" && expected.primary_article) {
    const pa          = expected.primary_article;
    const expSlug     = LAW_YEAR_TO_SLUG[pa.law_year as number] ?? "";
    const expArt      = String(pa.article_number);

    const rank1       = result.laws[0];
    const primaryRank1 =
      !result.noConfidentMatch &&
      !!rank1 &&
      rank1.lawSlug === expSlug &&
      rank1.articleNumber === expArt;

    const foundAt = result.laws.findIndex(
      (l) => l.lawSlug === expSlug && l.articleNumber === expArt
    ); // -1 = not found

    passed = primaryRank1;

    if (!passed) {
      if (result.noConfidentMatch) {
        label = "concept map gap";
        note  = "noConfidentMatch";
      } else if (foundAt >= 0) {
        label = "retrieval bug";
        note  = `found at rank ${foundAt + 1}, not rank 1  (rank-1=${rank1?.lawSlug?.split("-").slice(-1)[0]}/${rank1?.articleNumber})`;
      } else {
        label = "concept map gap";
        note  = rank1
          ? `wrong rank-1: ${rank1.lawSlug}/${rank1.articleNumber}`
          : `no laws returned (hasAnyResults=${result.hasAnyResults})`;
      }
    } else if (!rank1?.sourceUrl) {
      sourceGap = true;
      sourceGapIds.push(id);
      note = "sourceUrl=null";
    }

    if (label === "concept map gap") conceptMapGapIds.push(id);
    if (label === "retrieval bug")   retrievalBugIds.push(id);

  // ── action = "classify_civil" | "classify_and_clarify" ─────────────────
  } else if (action === "classify_civil" || action === "classify_and_clarify") {
    const criminalHit = result.laws.find((l) => l.lawSlug && CRIMINAL_SLUGS.has(l.lawSlug));
    passed = !criminalHit;
    if (!passed) {
      label = "concept map gap";
      note  = `criminal article at rank ${result.laws.indexOf(criminalHit!) + 1}: ${criminalHit!.lawSlug}/${criminalHit!.articleNumber}`;
      conceptMapGapIds.push(id);
    }

  // ── action = "no_reliable_match" | "no_reliable_match_and_clarify" ─────
  } else if (
    action === "no_reliable_match" ||
    action === "no_reliable_match_and_clarify"
  ) {
    passed = result.noConfidentMatch && !result.hasAnyResults;
    if (!passed) {
      label = "concept map gap";
      note  = result.hasAnyResults
        ? `articles returned: ${result.laws.length} laws, rank-1=${laws0}`
        : `noConfidentMatch=${result.noConfidentMatch} hasAnyResults=${result.hasAnyResults}`;
      conceptMapGapIds.push(id);
    }
  }

  const tag = passed ? "PASS " : "FAIL ";
  const lawsBrief = result.laws.slice(0, 3)
    .map((l) => `${l.lawSlug?.split("-").slice(-1)[0]}/${l.articleNumber}`)
    .join(", ");
  console.log(
    `T${String(id).padStart(2,"0")} [${tag}] ${category.padEnd(20)} ` +
    `noConf=${String(result.noConfidentMatch).padEnd(5)} laws=[${lawsBrief.padEnd(35)}]  ${note}`
  );

  outcomes.push({ id, category, action, passed, label, note, sourceGap, laws0 });
}

// ── Scorecard ─────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(100));
console.log("SCORECARD — BASELINE");
console.log("═".repeat(100));

const scored   = outcomes.filter((o) => o.passed !== null);
const passedN  = scored.filter((o) => o.passed === true).length;
const totalN   = scored.length;  // 27 (30 minus 3 future features)

console.log(`\nOverall:                ${passedN}/${totalN}  (counted; 3 future features excluded)  target ≥ 27/30`);

const rankTests  = outcomes.filter((o) =>
  o.action === "match" && o.label !== "future feature"
);
const rankPassed = rankTests.filter((o) => o.passed === true).length;
console.log(`Primary at rank 1:      ${rankPassed}/${rankTests.length}  target ≥ 16/17`);

const noCrimIds = [16,17,18,19,20,21,22,23];
const noCrim    = outcomes.filter((o) => noCrimIds.includes(o.id));
const noCrimOK  = noCrim.filter((o) => o.passed === true || o.label === "future feature").length;
console.log(`No criminal articles:   ${noCrimOK}/${noCrim.length}  T16–T23  target = 8/8`);

const abstIds   = [24,25,26,27,28];
const abstention = outcomes.filter((o) => abstIds.includes(o.id));
const abstOK    = abstention.filter((o) => o.passed === true).length;
console.log(`Abstention:             ${abstOK}/${abstention.length}  T24–T28  target = 5/5`);

const phoneIds  = [29,30];
const phonePassed = outcomes.filter((o) => phoneIds.includes(o.id) && o.passed === true).length;
console.log(`Phone typing:           ${phonePassed}/2  T29–T30  target = 2/2`);

console.log("");
console.log(`Concept map gaps  (${conceptMapGapIds.length}): T${conceptMapGapIds.join(", T")}`);
console.log(`Retrieval bugs    (${retrievalBugIds.length}): ${retrievalBugIds.length ? "T" + retrievalBugIds.join(", T") : "none"}`);
console.log(`Source gaps       (${sourceGapIds.length}): ${sourceGapIds.length ? "T" + sourceGapIds.join(", T") : "none"} — articles found but sourceUrl=null (not counted as failures)`);
console.log(`Future feature    (${futureFeatureIds.length}): T${futureFeatureIds.join(", T")} — clarification_required, not counted`);
console.log("");
