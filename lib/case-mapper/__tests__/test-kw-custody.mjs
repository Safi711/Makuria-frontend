import { factsMatchCustodyMaintenance as c, factsMatchUndocumentedDivorce as d } from "../kw-matcher.mjs";
const F = `من يوم اتفارقنا قبل خمسة شهور، ولدي البالغ  من العمر أربع سنين ساكن معاي، وأنا البدفع أكله وعلاجه. أبوه قال لي قدّام أختي «إنتِ طالق»، لكن ما عندي ورقة طلاق. هسع قال لي جيبي الولد يسكن معاي وأنا بصرف عليه عندي. أقدر أطالب بمصاريف الولد هسع؟ ولو طالبت، ده بأثّر على بقاء الولد معاي؟`;
const C = [[F, true], ["طليقي ما بدفع نفقة البنت وعايز ياخد البنت مني", true], ["ولدي عيان وما عندي قروش العلاج", false], ["عايزة أطالب بنفقة لنفسي", false]];
const D = [[F, true], ["زوجي طلقني بالكلام بس وما في ورقة", true], ["طلقني وعندي قسيمة الطلاق", false]];
let ok = 0, n = 0;
for (const [t, w] of C) { n++; if (c(t) === w) ok++; else console.log("FAIL custody", w, t.slice(0, 40)); }
for (const [t, w] of D) { n++; if (d(t) === w) ok++; else console.log("FAIL divorce", w, t.slice(0, 40)); }
console.log(`${ok}/${n}`); process.exit(ok === n ? 0 : 1);
