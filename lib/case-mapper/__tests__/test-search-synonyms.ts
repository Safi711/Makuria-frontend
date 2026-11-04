// Site search synonyms (Nov 4): «سقوط الدعوى» must reach «انقضاء الدعوى» (إجراءات جنائية م37).
import { synonymVariants, mergeVariantResults } from "../../search-synonyms";
let pass = 0, total = 0;
function eq(name: string, got: unknown, want: unknown) {
  total++; const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` → ${JSON.stringify(got)}`}`);
}
eq("سقوط → انقضاء ومسقط", synonymVariants("أسباب سقوط الدعوى الجنائية"),
  ["أسباب سقوط الدعوى الجنائية", "انقضاء الدعوى الجنائية", "مسقط الدعوى الجنائية"]);
eq("«أسباب» تبقى في السؤال الأصلي بلا مرادف", synonymVariants("أسباب الطلاق"), ["أسباب الطلاق"]);
eq("إنقضاء بالهمزة", synonymVariants("إنقضاء الدعوى")[1], "سقوط الدعوى");
eq("تسقط → تنقضي", synonymVariants("متى تسقط الدعوى"), ["متى تسقط الدعوى", "متى تنقضي الدعوى"]);
eq("لا مرادف: السؤال وحده", synonymVariants("عقوبة السرقة"), ["عقوبة السرقة"]);
const merged = mergeVariantResults([
  [{ result_type: "case", entity_id: "c1", status_rank: 0, rank: 5, match_source: "partial" }],
  [{ result_type: "article", entity_id: "a37", status_rank: 0, rank: 5, match_source: "text" },
   { result_type: "case", entity_id: "c1", status_rank: 0, rank: 5, match_source: "partial" }],
  [{ result_type: "article", entity_id: "a38", status_rank: 0, rank: 6, match_source: "partial" }],
], 25);
eq("المطابقة الكاملة قبل الجزئية، بلا تكرار", merged.map((r) => r.entity_id), ["a37", "c1", "a38"]);
eq("النافذ قبل الملغى", mergeVariantResults([[
  { result_type: "article", entity_id: "old", status_rank: 2, rank: 1 },
  { result_type: "article", entity_id: "new", status_rank: 0, rank: 5 }]], 25).map((r) => r.entity_id), ["new", "old"]);
console.log(`${pass}/${total}`);
if (pass !== total) process.exit(1);
