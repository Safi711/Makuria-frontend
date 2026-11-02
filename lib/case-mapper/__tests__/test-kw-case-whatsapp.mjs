import { factsMatchParticipation as p, factsMatchPublishedAccusation as a } from "../kw-matcher.mjs";
const F = `زول رسّل لي في الخاص على الواتساب صورة من محادثة قديمة بيناتنا وقال لي «حوّلي لي قروش قبل المغرب وإلا بنزّل بقية المحادثة». ما حوّلت ليه. بالليل لقيته نشر في قروب الحِلّة على فيسبوك أول سطرين من المحادثة وكتب فوقهم إني بجمع تبرعات الناس لنفسي. عندي الرسالة الأصلية وصورة المنشور قبل ما يمسحو.`;
const P = [
  [F, false],
  ["ناس هجموا على البيت وكسروا الباب", true],
  ["أكل قروش الناس وهرب", false],
];
const A = [
  [F, true],
  ["جاري نشر في الفيسبوك إني حرامي", true],
  ["نزّل بوست قال إني نصاب", true],
  ["جاري سبّني في الشارع", false],
  ["نشر صوري في القروب", false],
];
let ok = 0, n = 0;
for (const [t, w] of P) { n++; if (p(t) === w) ok++; else console.log("FAIL particip", w, t.slice(0, 40)); }
for (const [t, w] of A) { n++; if (a(t) === w) ok++; else console.log("FAIL publish", w, t.slice(0, 40)); }
console.log(`${ok}/${n}`); process.exit(ok === n ? 0 : 1);
