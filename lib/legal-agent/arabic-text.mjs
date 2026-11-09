// Arabic text checks for extracted PDF text (phase 1).
// Two jobs, both approved by Safi on 2026-11-09:
//  1. normalizeArabicText: repair spacing artifacts that PDF extraction leaves behind.
//  2. detectVisualOrder: flag text whose letters were stored in visual (reversed)
//     order, which cannot be repaired reliably and must not be used for drafting.

// Arabic letters (base block) used as the denominator for the presentation-form ratio.
const ARABIC_LETTER_RE = /[ء-ي]/g;
// Presentation forms A and B: glyph variants that appear when text is stored visually.
const PRESENTATION_FORM_RE = /[ﭐ-﷿ﹰ-﻿]/g;

// Thresholds derived from the 2026-11-09 samples:
//  - article-139 test (logical order): 0 presentation forms.
//  - sources report (visual order): 1853 presentation forms vs 1248 letters (ratio 1.48).
const MIN_PRESENTATION_FORMS = 20;
const VISUAL_ORDER_RATIO = 0.2;

export function detectVisualOrder(text) {
  const forms = (text.match(PRESENTATION_FORM_RE) || []).length;
  const letters = (text.match(ARABIC_LETTER_RE) || []).length;
  const ratio = forms / Math.max(letters, 1);
  return {
    presentationForms: forms,
    arabicLetters: letters,
    ratio: Number(ratio.toFixed(2)),
    unreliable: forms >= MIN_PRESENTATION_FORMS && ratio >= VISUAL_ORDER_RATIO,
  };
}

// Repairs two artifacts seen in the article-139 sample:
//  - lam and alef split by a space: "ل ا" -> "لا" (only when "ا" stands alone as a word).
//  - harakat (shadda, tanween, etc.) separated from their letter: "ماء ً" -> "ماءً".
// Presentation forms are folded to base letters with NFKC. Returns the fix count.
export function normalizeArabicText(text) {
  let fixes = 0;
  let out = text.normalize("NFKC");
  out = out.replace(/(^|\s)ل\s+ا(?=\s|$|[ً-ْ])/g, (_, pre) => {
    fixes++;
    return pre + "لا";
  });
  out = out.replace(/ +(?=[ً-ْ])/g, () => {
    fixes++;
    return "";
  });
  return { text: out, fixes };
}
