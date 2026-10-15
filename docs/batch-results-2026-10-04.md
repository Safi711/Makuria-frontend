# Batch Run Results — Stage 1 Batches 01–09
**Date:** 2026-10-04  
**Branch:** semantic-layer  
**Runner:** `lib/case-mapper/__tests__/run-batch1.ts`  
**Model (LLM classifier):** claude-haiku-4-5-20251001  

---

## Scorecard

| Batch | Score | Pass | Half | Fail | Unscored¹ | Target met? |
|-------|------:|-----:|-----:|-----:|----------:|:-----------:|
| B1 (001–010) | 9/9 | 9 | 0 | 0 | 1 | ✓ |
| B2 (011–020) | 9/9 | 9 | 0 | 0 | 1 | ✓ |
| B3 (021–030) | 7/9 | 7 | 0 | 2 | 1 | ✗ |
| B4 (031–040) | 8/9 | 8 | 0 | 1 | 1 | ✗ |
| B5 (041–050) | 9/9 | 9 | 0 | 0 | 1 | ✓ |
| B6 (051–060) | 9/9 | 9 | 0 | 0 | 1 | ✓ |
| B7 (061–070) | 9/9 | 9 | 0 | 0 | 1 | ✓ |
| B8 (071–080) | 7/9 | 7 | 0 | 2 | 1 | ✗ |
| B9 (081–090) | 9/9 | 9 | 0 | 0 | 1 | ✓ |
| **Total** | **76/81** | **76** | **0** | **5** | **9** | |

¹ Each batch has one `must_discuss` drug-possession case (حيازة مادة مخدرة محظورة, narcotics-1994) that is unscored pending lawyer review. The system correctly returns narcotics-1994 articles at rank-1 for all 9.

---

## Failing cases

| ID | Concept (expected) | Expected art. | Actual rank-1 | Root cause |
|----|-------------------|---------------|---------------|------------|
| S1-B3-027 | تملك جنائي | 180 | 1991/177 (خيانة الأمانة) | C — loan-for-use misclassified as trust |
| S1-B3-028 | ابتزاز | 176 | 1991/175 (النهب) | A — victim-surrenders case mapped to سطو |
| S1-B4-039 | الجراح العمد (+ discuss attempted murder) | 139 | noConfidentMatch | B — LLM abstains on ambiguous-intent gunshot |
| S1-B8-078 | ابتزاز | 176 | 1991/175 (النهب) | A — same as B3-028 |
| S1-B8-079 | الجراح العمد (+ discuss attempted murder) | 139 | noConfidentMatch | B — same as B4-039 |

---

## Case facts (failing cases only)

**S1-B3-027** (تملك جنائي)  
سلّم المجني عليه المتهم جهاز حاسوب لاستعماله مؤقتًا في عمل محدد ثم إعادته. باع المتهم الجهاز لشخص آخر واحتفظ بالثمن لنفسه.

**S1-B3-028 / S1-B8-078** (ابتزاز — same pattern)  
B3-028: دخل المتهم متجرًا وهدد العامل بسلاح أبيض مطالبًا بالنقود، فسلّمه العامل المال خوفًا من الاعتداء.  
B8-078: اعترض المتهم المجني عليه أثناء سيره، وهدده بأداة حادة، ثم أجبره على تسليم هاتفه ونقوده.

**S1-B4-039 / S1-B8-079** (الجراح العمد — same pattern)  
B4-039: أطلق المتهم عيارًا ناريًا في اتجاه المجني عليه فأصابه في كتفه ونجا بعد العلاج. لا تتضمن الوقائع المعطاة معلومات كافية عن المسافة أو موضع التصويب أو الأقوال أو الملابسات التي تكشف القصد.  
B8-079: أطلق المتهم عيارًا ناريًا أصاب المجني عليه في ساقه وأحدث إصابة خطرة. لا تتضمن الوقائع معلومات كافية عن موضع التصويب المقصود أو المسافة أو الأقوال أو الملابسات التي تكشف نية القتل.
