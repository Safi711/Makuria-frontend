# Impersonation Gate — Approved Rules (2026-10-07)

Fires when a subject claimed a public-official identity in the facts. Two outcomes:

* **احتيال path** (LLM returns احتيال): Art. 178 stays rank 1; inject Art. 93 as open-point discuss card.
* **انتحال path** (LLM returns انتحال + money taken): override criminalTerms to "احتيال" (Art. 178 rank 1) + inject Art. 93 discuss card.

## Gate conditions

### Condition A — impostor verb

`factsMatchKeywords(facts, IMPOSTOR_VERB_KW)` — at least one token from the list below appears.

```
IMPOSTOR_VERB_KW = [
  "انتحل", "منتحل", "انتحال صفة",
  "ادعى", "مدعي",
  "زعم",
  "أوهم",
  "تظاهر", "متظاهر",
  "قدم نفسه",
]
```

### Condition B — claim-marker proximity

`factsMatchClaimMarker(facts, PUBLIC_OFFICIAL_KW)` — a **claim marker** is followed by an **official keyword** within at most **2 filler tokens**. The official keyword must NOT start with ل (preposition: للموظف, لضابط do NOT count).

**Claim markers:** أنه / بأنه / صفة / شخصية

**Filler tokens (allowed between marker and keyword):** من / يعمل / في / أحد / أفراد

```
PUBLIC_OFFICIAL_KW = [
  "موظف", "موظفين", "موظفي",
  "ضابط", "ضباط",
  "مأمور",
  "وزارة",
  "حكومي",
  "مباحث",
]
```

Gate fires (prox) when **both A and B hold**.

### Condition C — money taking (انتحال override only)

`factsMatchMoneyTake(facts)` — fires when:

1. At least one **taking verb** appears that is **NOT** followed by على/عليه/عليهم/عليها (those mean *arrest*, not receipt of money).
2. At least one **money noun** appears anywhere.

```
TAKING_VERB_KW  = ["قبض", "استلم", "أخذ", "تسلم", "تحصل", "حصل على"]
MONEY_NOUN_KW   = ["مبلغ", "مال", "أموال", "مبالغ", "نقود", "فلوس", "ثمن", "رسوم", "دفعة"]
ARREST_POSTFIX  = {"على", "عليه", "عليهم", "عليها", "عليهن"}
```

**Override** (انتحال path → Art. 178 rank 1) fires only when prox **AND** money-take both hold.

## KW_ARTICLE_PREFIXES extension

Single-char conjunctions و/ف/ب/ك are stripped before token matching (in addition to the compound وال/فال/بال/كال/لل/ال). ل is intentionally **not** stripped — it would incorrectly match ل-prefixed keywords that the claim-marker gate already excludes. This makes "وقبض" and "بأنه" strip to "قبض" and "أنه" for matching.

## Open-point card wording

**Label:** انتحال صفة الموظف العام (المادة ٩٣)

**Desc:** تفيد الوقائع أن المتهم ادّعى صفة موظف عام للحصول على المال. الوصف الأساسي هو الاحتيال (المادة ١٧٨). على المحامي أن يبحث: هل يقوم انتحال الصفة جريمةً مستقلة إلى جانب الاحتيال، أم هو مجرد وسيلة له؟ والمادة ٩٣ تشترط سوء القصد.

## 16-row fire/no-fire table

| # | Facts | prox | money-take | override | Note |
|---|-------|------|-----------|---------|------|
| 1 | قبض المبلغ منتحلاً صفة ضابط | ✓ | ✓ | ✓ | صفه→CM, ضابط immediately after |
| 2 | مدعياً أنه من المباحث | ✓ | — | — | انه→CM, من=filler, المباحث→مباحث |
| 3 | أوهم المجني عليه بأنه موظف في مكتب الأراضي | ✓ | — | — | بانه→CM, موظف (no ل) |
| 4 | ادعى أنه ضابط | ✓ | — | — | انه→CM, ضابط |
| 5 | تظاهر بأنه مأمور | ✓ | — | — | بانه→CM, مامور |
| 6 | متظاهراً بأنه موظف حكومي | ✓ | — | — | بانه→CM, موظف |
| 7 | ادعى أنه يعمل ضابطاً في الشرطة | ✓ | — | — | انه→CM, يعمل=filler, ضابطاً startsWith ضابط |
| 8 | ادعى الشاكي أن المتهم احتال عليه في بيع عربة، والشاكي موظف بوزارة الصحة | ✗ | — | — | أن≠أنه; موظف never in claim-marker window |
| 9 | زعم المتهم أنه سدد المبلغ كاملاً للموظف المختص | ✗ | — | — | انه→CM, سدد not official, not filler; للموظف starts ل |
| 10 | زعم المتهم أنه سدد المبلغ للموظف المختص | ✗ | — | — | same; كاملاً absent — سدد still not filler |
| 11 | استلم المبلغ من الموظف المختص | ✗ | ✓ | ✗ | money only (استلم+مبلغ); no impostor verb → prox=false |
| 12 | ادعى أنه سدد المبلغ | ✗ | — | — | انه→CM, سدد not official, not filler → blocked |
| 13 | أقر بأنه موظف حكومي | ✗ | — | — | أقر not in IMPOSTOR_VERB_KW → condition A fails |
| 14 | ادعى أنه ضابط وأوقف العربة وطلب الرخصة، وكان مع السائق مبلغ كبير | ✓ | ✗ | ✗ | prox fires; مبلغ present but no taking verb |
| 15 | ادعى أنه ضابط وقبض من الشاكي مبلغاً | ✓ | ✓ | ✓ | prox+money both fire → override |
| 16 | ادعى أنه ضابط، وقبضت عليه الشرطة وبحوزته مبلغ | ✓ | ✗ | ✗ | "وقبضت عليه" → taking verb followed by على → arrest, not receipt |
