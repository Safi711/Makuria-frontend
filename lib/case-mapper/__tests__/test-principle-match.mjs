import { matchPrinciples as m } from "../principle-match.mjs";
const P = [
  { id: "a", title_ar: "التقادم المكسب واكتساب ملكية الأرض بالحيازة الطويلة", summary_ar: "الحيازة الفعلية والمستمرة لأرض تكسب الحائز حق الملكية بالتقادم" },
  { id: "b", title_ar: "معيار الاستفزاز الجسيم والمفاجئ فى جريمة القتل", summary_ar: "" },
];
const ids = (r) => r.map((x) => x.id).join(",");
const cases = [
  ["art 649 title", ids(m(["التقادم المكسب للملكية"], P)), "a"],
  ["apartments only", ids(m(["تمليك الطبقات والشقق"], P)), ""],
  ["contract breach", ids(m(["الإخلال بالعقد", "إنجاز العمل"], P)), ""],
  ["one shared word", ids(m(["الملكية الشائعة"], P)), ""],
  ["murder titles", ids(m(["القتل العمد", "الاستفزاز الشديد المفاجئ"], P)), "b"],
];
let bad = 0;
for (const [n, got, want] of cases) { const ok = got === want; if (!ok) bad++; console.log(`${ok ? "✓" : "✗"} ${n} → [${got}]`); }
console.log(`${cases.length - bad}/${cases.length} passed`); process.exit(bad ? 1 : 0);
