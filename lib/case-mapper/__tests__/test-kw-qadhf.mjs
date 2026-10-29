// factsMatchQadhfImputation verification (case 7 fix: "حرامي" is not qadhf).
import { factsMatchQadhfImputation } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── POSITIVES: imputation of zina / liwat / denial of lineage ──
  ["واحد قال لمرة متزوجة قدام الناس إنها زانية", true, "Q1 case 30 — زانية"],
  ["رماها بالزنا أمام الجيران", true, "Q2 بالزنا"],
  ["قال عنه إنه زاني في المجلس", true, "Q3 زاني"],
  ["اتهمه باللواط على فيسبوك", true, "Q4 باللواط"],
  ["قال له يا لوطي قدام الناس", true, "Q5 لوطي"],
  ["قال للبت يا شرموطة", true, "Q6 شرموطة"],
  ["قال إنها عاهرة", true, "Q7 عاهرة"],
  ["قال له يا ولد الحرام", true, "Q8 ولد الحرام — denial of lineage"],
  ["قال إن الولد ده ما ولده", true, "Q9 ما ولده — denial of lineage"],
  ["كتب في الواتساب إنها زنت مع جارها", true, "Q10 زنت"],
  ["قال له يا ابن زنا", true, "Q11 ابن زنا"],
  // ── NEGATIVES: insults that are NOT qadhf ──
  ["واحد قال لزول قدام الناس في السوق يا حرامي", false, "N1 case 7 — حرامي is not qadhf"],
  ["شتمه وقال له يا حرامي يا كذاب", false, "N2 حرامي + كذاب"],
  ["قال عنه إنه نصاب وسارق أمام زملائه", false, "N3 نصاب/سارق"],
  ["سبه بألفاظ نابية", false, "N4 generic insult"],
  ["نشر في الفيسبوك إنه مرتشي في الوظيفة", false, "N5 bribery allegation → 159 not 157"],
  ["قال له يا حمار", false, "N6 حمار"],
  ["قال إن ماله حرام", false, "N7 مال حرام ≠ ولد حرام"],
  ["اكل الحرام وحرامي", false, "N8 الحرام alone"],
  ["ضغط على الزناد", false, "N9 الزناد ≠ زنا"],
];

let pass = 0, fail = 0;
for (const [text, expected, note] of tests) {
  const got = factsMatchQadhfImputation(text);
  if (got === expected) { pass++; }
  else { fail++; console.log(`FAIL ${note}: expected ${expected}, got ${got} — ${text}`); }
}
console.log(`${pass}/${tests.length} passed`);
if (fail) process.exit(1);
