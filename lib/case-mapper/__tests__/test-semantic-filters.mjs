import { keepSemanticRow as k } from "../semantic-filters.mjs";
const P = "procurement-contracting-disposal-act-2010";
const cases = [
  ["private contractor", k(P, "اتفق مقاول مع صاحب منزل على بناء سور وتأخر."), false],
  ["ministry contract", k(P, "تأخر المقاول في تنفيذ عقد مع وزارة الصحة."), true],
  ["public tender", k(P, "فاز مقاول في مناقصة لبناء مدرسة."), true],
  ["government body", k(P, "تعاقدت جهة حكومية مع مقاول."), true],
  ["other laws untouched", k("civil-transactions-1984", "اتفق مقاول مع صاحب منزل."), true],
];
let bad = 0;
for (const [n, got, want] of cases) { const ok = got === want; if (!ok) bad++; console.log(`${ok ? "✓" : "✗"} ${n}`); }
console.log(`${cases.length - bad}/${cases.length} passed`);
process.exit(bad ? 1 : 0);
