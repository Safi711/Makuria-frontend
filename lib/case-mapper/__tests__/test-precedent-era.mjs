import { precedentEraNotice as n } from "../precedent-era.mjs";
const cases = [
  ["older criminal", n(1983, true)?.includes("1983"), true],
  ["year of the Act", n(1991, true), null],
  ["newer", n(2005, true), null],
  ["unknown year", n(null, true), null],
  ["older, not criminal", n(1983, false), null],
];
let bad = 0;
for (const [name, got, want] of cases) {
  const ok = got === want; if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}
console.log(`${cases.length - bad}/${cases.length} passed`);
process.exit(bad ? 1 : 0);
