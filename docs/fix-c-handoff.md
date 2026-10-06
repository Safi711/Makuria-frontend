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

### 5. Art. 170 (hadd theft) — conditional on hirz and nisab

Art. 170 (سرقة حدّية) appears in the related-articles list for plain theft (Art. 174) without any condition. The lawyer's ruling: Art. 170 applies only when both hirz (secure custody) and nisab (minimum threshold value) are established. Until those conditions are confirmed by the lawyer, Art. 170 must be an open point in the discuss section, not a related article shown unconditionally.

### 6. Precedent cards predate the applicable law — no visible note

The related precedents for plain theft include hadd-theft cases from 1985–1989, decided before the Criminal Act 1991 came into force. Any judgment whose year is earlier than the law applied should carry a visible note ("هذا الحكم سابق لصدور القانون المطبَّق") to alert the reader. Currently "سبب الصلة" repeats the principle text verbatim rather than explaining why the case is relevant to the current article.

## Batch 10 — live run 2026-10-05 (10/10, single run, no fixes)

| ID | Facts (short) | Expected | Rank-1 returned | Result |
|---|---|---|---|---|
| S1-B10-091 | محفظة ضائعة — أخذ المبلغ | Art. 180 | criminal-law-1991 / 180 | PASS |
| S1-B10-092 | عامل أودع نصف المبلغ فقط | Art. 177 | criminal-law-1991 / 177 | PASS |
| S1-B10-093 | مخدرات + ميزان + شهود بيع | Art. 15 (narcotics) | narcotics-1994 / 15 | PASS |
| S1-B10-094 | دفع امرأة وخطف حقيبتها | Art. 175 | criminal-law-1991 / 175 | PASS |
| S1-B10-095 | تهديد بنشر صور مقابل مال | Art. 176 | criminal-law-1991 / 176 | PASS |
| S1-B10-096 | ضرب بعصا → جرح مفتوح | Art. 139 | criminal-law-1991 / 139 | PASS |
| S1-B10-097 | انتحل موظف أراضي وأخذ مال | Art. 178 | criminal-law-1991 / 178 | PASS |
| S1-B10-098 | شيك بلا رصيد مع العلم | Art. 179 | criminal-law-1991 / 179 | PASS |
| S1-B10-099 | مستأجر رفض الإخلاء | abstain (civil) | noConfidentMatch=true | PASS |
| S1-B10-100 | صاحبي خدعني (عامية مبهمة) | abstain (vague) | noConfidentMatch=true | PASS |

### Open items from batch 10 (tail, not rank-1)

- **093**: Art. 20 and Art. 16 returned as applicable alongside Art. 15 in a clear dealing case — both are incorrect here (no personal use, no supply-to-minor facts).
- **096**: Art. 142, 140, 141 returned as applicable beside Art. 139; also raised attempted murder (Art. 130 + 19 + 20) as an open discuss point — the attempted-murder flag may be over-eager for a single blow with injury.
- **097**: Art. 111 (التصرف في الأموال بطريق الغش) returned alongside Art. 178; impersonating a public official (Art. 110 or similar) not mentioned despite the facts naming a government office.
- **099**: abstained with caseType=none, although rent-of-premises-act-1991 and civil-transactions-1984 are in the library — the civil path is not surfaced at all.
- **General**: the scoring metric checks rank-1 only; the tail of returned articles is unmeasured. B10 is the first batch to surface tail noise as a distinct concern.

## Rule ق regression note (resolved)

Commit 178e961 introduced rule ق (narcotics intent-gate) and caused a deterministic regression on S1-B4-031 (سرقة — bicycle taken from owner). Rule ر (commit a0b1aaf) fixed it by making the سرقة/تملك جنائي criterion explicit. See section 5 of the previous handoff snapshot in git history for the full test table.
