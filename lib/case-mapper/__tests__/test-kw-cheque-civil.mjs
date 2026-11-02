import { factsMatchChequeCivilRemainder as f } from "../kw-matcher.mjs";
const F = `بعت زول بضاعة بـ٨ ملايين جنيه، وكتب لي شيك بالمبلغ يستحق بعد شهر. قبل الموعد حوّل لي ٣ ملايين وكتب في رسالة «دي دفعة من حق البضاعة». يوم الشيك مشيت البنك، ورجّعوه لي بإفادة مكتوب فيها إن الرصيد غير كافٍ. الزول بقول لي رجّع الشيك أول وبعدها بنتفاهم. أعمل شنو في الشيك وفي باقي قروشي؟`;
const C = [[F, true], ["الشيك ارتد والزول قال لي رجّع الشيك", true], ["اديته شيك وارتد", false], ["عندي شيك ما صرفته لسه، وفضل الباقي", false]];
let ok = 0; for (const [t, w] of C) { if (f(t) === w) ok++; else console.log("FAIL", w, t.slice(0, 40)); }
console.log(`${ok}/${C.length}`); process.exit(ok === C.length ? 0 : 1);
