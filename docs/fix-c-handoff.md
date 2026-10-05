# Fix C Handoff — 2026-10-05

## Current scores (branch semantic-layer, commit a0b1aaf)

- **Batches:** 90/90 (9 batches × 10 cases; all drug-possession cases PASS with intentUnknown)
- **Golden:** 25/31 (28 scored; T21–T23 missing feature; T26–T28 skipped future feature)

## What is still open before pushing

### 1. Clarification feature — T21, T22, T23, T26, T27, T28

T21–T23 (`classify_and_clarify`): Abu Rannat classifies these correctly as `administrative_or_constitutional` and abstains, but no clarification prompt is returned. Score: always FAIL until the feature ships.

T26–T28 (`no_reliable_match_and_clarify`): skipped from scoring entirely. Same missing piece: a structured clarification path in the classifier output and a UI component to collect the answer.

These 6 cases are the only gap between 25/31 and the 27/31 target.

### 2. source_url missing for criminal-law-1991

All 16 criminal-law-1991 golden cases return `sourceUrl=null`. The code is correct — it reads `laws.source_url` from the DB and passes it through. The data is missing: `criminal-law-1991` has no `source_url` row. Not a code fix; the URL must be added to the `laws` table directly.

### 3. Batch 10 not yet written

The approved lawyer batches cover B1–B9 (90 cases). B10 has not been written or scored.

### 4. AdvisorPage discuss card not visually checked

The narcotics intent-gate feature adds two discuss cards (Art. 15 and Art. 20) when `intentUnknown=true`. The `description` field per card is wired up in code and renders via `item.description`. The card has not been opened in a browser to verify layout, RTL alignment, or that the gold left-border renders correctly for both cards.

## Rule ق regression note (resolved)

Commit 178e961 introduced rule ق (narcotics intent-gate) and caused a deterministic regression on S1-B4-031 (سرقة — bicycle taken from owner). Rule ر (commit a0b1aaf) fixed it by making the سرقة/تملك جنائي criterion explicit. See section 5 of the previous handoff snapshot in git history for the full test table.
