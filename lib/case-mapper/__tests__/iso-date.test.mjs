// Run: node lib/case-mapper/__tests__/iso-date.test.mjs
import assert from "node:assert/strict";
import { isValidIsoDate } from "../iso-date.mjs";

const cases = [
  ["2026-03-10", true],
  ["2024-02-29", true],
  ["2026-12-31", true],
  ["2026-02-29", false], // not a leap year
  ["2026-13-01", false],
  ["2026-00-10", false],
  ["2026-3-1", false],
  ["10/03/2026", false],
  ["2026-03-10x", false],
  ["", false],
  [undefined, false],
];
let ok = 0;
for (const [value, want] of cases) {
  assert.equal(isValidIsoDate(value), want, `isValidIsoDate(${JSON.stringify(value)})`);
  ok++;
}
console.log(`${ok}/${cases.length} date cases passed`);
