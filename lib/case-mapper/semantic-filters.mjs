/**
 * Procurement law governs contracts with public bodies. A private contractor's
 * dispute reached it through the word «مقاول» alone (B15-148, Art. 72 on delay
 * penalties in public works). Safi, 4 Nov 2026: keep it only when the facts
 * mention a public body or a public contract.
 * Run tests: node lib/case-mapper/__tests__/test-semantic-filters.mjs
 */
import { factsMatchKeywords } from "./kw-matcher.mjs";

const PROCUREMENT_SLUG = "procurement-contracting-disposal-act-2010";
const PUBLIC_CONTRACT_KW = [
  "حكومة", "حكومي", "حكومية", "الدولة", "جهة إدارية", "الجهة الإدارية",
  "وزارة", "محلية", "مؤسسة عامة", "هيئة عامة", "مناقصة", "عطاء", "عطاءات",
  "أشغال عامة", "مشتريات", "مرفق عام",
];

export function keepSemanticRow(lawSlug, facts) {
  return lawSlug !== PROCUREMENT_SLUG || factsMatchKeywords(facts, PUBLIC_CONTRACT_KW);
}
