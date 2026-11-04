// Nov 4: Abu Rannat's database searches — at most 3 at once, one retry on timeout.
import { mapLimited, rpcWithRetry, newSearchFailures } from "../search-pool";
let pass = 0, total = 0;
const ok = (n: string, c: boolean, g?: unknown) => { total++; if (c) pass++; console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : " → " + JSON.stringify(g)}`); };
(async () => {
  let running = 0, peak = 0;
  const out = await mapLimited([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (x) => {
    running++; peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5 + (x % 3) * 3));
    running--; return x * 10;
  });
  ok("لا أكثر من 3 في وقت واحد", peak === 3, peak);
  ok("النتائج بنفس الترتيب", JSON.stringify(out) === JSON.stringify([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]), out);
  ok("قائمة فارغة", (await mapLimited([], 3, async () => 1)).length === 0);

  const fake = (seq: Array<{ data: unknown; error: { code?: string } | null }>) => {
    let i = 0; const calls = { n: 0 };
    return { client: { rpc: async () => { calls.n++; return seq[Math.min(i++, seq.length - 1)]; } } as never, calls };
  };
  let f = fake([{ data: null, error: { code: "57014" } }, { data: [1], error: null }]);
  let st = newSearchFailures();
  let r = await rpcWithRetry(f.client, "quick_search_v4", {}, st);
  ok("المهلة: يعيد مرة وينجح", r.error === null && f.calls.n === 2 && st.timeouts === 1 && st.failed === 0, { r, st });
  f = fake([{ data: null, error: { code: "57014" } }]);
  st = newSearchFailures();
  r = await rpcWithRetry(f.client, "quick_search_v4", {}, st);
  ok("المهلة مرتين: يُحسب فاشلاً ولا يعيد أكثر من مرة", r.error !== null && f.calls.n === 2 && st.failed === 1, { st, n: f.calls.n });
  f = fake([{ data: null, error: { code: "PGRST202" } }]);
  st = newSearchFailures();
  r = await rpcWithRetry(f.client, "quick_search_v4", {}, st);
  ok("خطأ غير المهلة: لا إعادة", f.calls.n === 1 && st.failed === 1 && st.timeouts === 0, { st });
  console.log(`${pass}/${total}`);
  if (pass !== total) process.exit(1);
})();
