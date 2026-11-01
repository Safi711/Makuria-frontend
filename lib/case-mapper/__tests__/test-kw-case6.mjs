import { factsMatchEmployeeTookMoney as f } from "../kw-matcher.mjs";
const cases = [
  ["موظف في بنك حوّل مبالغ من حسابات عملاء إلى حسابه", true],
  ["محاسب الشركة اختلس مبلغ كبير", true],
  ["الصراف أخذ مبالغ من الخزنة", true],
  ["موظف في الوزارة استولى على المال العام", true],
  ["موظفة حولت أموال الشركة لحسابها", true],
  ["المدير أخد قروش الشركة وسافر", true],
  ["جاري سرق تلفوني", false],
  ["موظف ضربني في الشغل", false],
  ["شخص حوّل مبالغ من حسابي بالاحتيال", false],
  ["موظف في البنك رفض يفتح لي حساب", false],
];
let ok = 0;
for (const [t, want] of cases) { const got = f(t); if (got === want) ok++; else console.log("FAIL", want, t); }
console.log(`${ok}/${cases.length}`); process.exit(ok === cases.length ? 0 : 1);
