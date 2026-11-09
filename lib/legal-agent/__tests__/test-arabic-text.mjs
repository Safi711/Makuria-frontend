// Tests for Arabic normalization and visual-order detection.
// Run: node lib/legal-agent/__tests__/test-arabic-text.mjs
import assert from "node:assert/strict";
import { normalizeArabicText, detectVisualOrder } from "../arabic-text.mjs";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("lam and alef split by a space are rejoined when alef stands alone", () => {
  const r = normalizeArabicText("لا يُستبعد؛ ل ا تُعرض");
  assert.equal(r.text, "لا يُستبعد؛ لا تُعرض");
  assert.equal(r.fixes, 1);
});

test("a standalone ل followed by a word starting with ا is not rewritten by mistake", () => {
  // "ل" then "اسم": alef is not standalone, so no rewrite.
  const r = normalizeArabicText("ل اسم");
  assert.equal(r.text, "ل اسم");
});

test("harakat separated from their letter are rejoined", () => {
  assert.equal(normalizeArabicText("ماء ً").text, "ماءً");
  assert.equal(normalizeArabicText("كب ّ شخص").text, "كبّ شخص");
});

test("presentation forms are folded to base letters", () => {
  // ﻻ (lam-alef ligature) and ﺔ (teh marbuta final form)
  assert.equal(normalizeArabicText("ﻻ").text, "لا");
  assert.equal(normalizeArabicText("ﺔ").text, "ة");
});

test("logical-order Arabic (article-139 style) is not flagged", () => {
  const v = detectVisualOrder("اختبار المادة ١٣٩ حالات اختبار للمراجعة القانونية");
  assert.equal(v.presentationForms, 0);
  assert.equal(v.unreliable, false);
});

test("visual-order Arabic with many presentation forms is flagged", () => {
  // Letters of "منصة كوميار" stored visually (presentation forms, reversed).
  const visual = "ﺎ ﻳ ر ﻮ ﻜ ﻣ ﺔ ﺼ ﻨ ﻣ ﺎ ﻳ ر ﻮ ﻜ ﻣ ﺔ ﺼ ﻨ ﻣ ﺎ ﻳ ر ﻮ ﻜ ﻣ ﺔ ﺼ ﻨ ﻣ";
  const v = detectVisualOrder(visual);
  assert.ok(v.presentationForms >= 20);
  assert.ok(v.ratio >= 0.2);
  assert.equal(v.unreliable, true);
});

test("a few presentation forms in otherwise normal text are not enough to flag", () => {
  const v = detectVisualOrder("نص عربي طويل " .repeat(20) + "ﻻ");
  assert.equal(v.unreliable, false);
});

console.log(`\n${passed} tests passed`);
