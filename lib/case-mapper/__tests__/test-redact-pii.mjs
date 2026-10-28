/**
 * Unit tests for redactPII (privacy step before the external model).
 * Run: node lib/case-mapper/__tests__/test-redact-pii.mjs
 */
import { redactPII } from "../redact-pii.mjs";

let passed = 0;
let failed = 0;
function eq(label, input, expected) {
  const got = redactPII(input);
  if (got === expected) { passed++; console.log("✓", label); }
  else { failed++; console.log("✗", label, "\n   got:      ", got, "\n   expected: ", expected); }
}
function keeps(label, input) { eq(label, input, input); }

// ── identifiers are removed
eq("phone Sudan local", "اتصل بي على 0912345678 ليلاً", "اتصل بي على [رقم] ليلاً");
eq("phone with spaces", "رقمه 091 234 5678 وما رد", "رقمه [رقم] وما رد");
eq("phone international", "رقمها +249912345678", "رقمها [رقم]");
eq("phone 00249", "على الرقم 00249 91 234 5678.", "على الرقم [رقم].");
eq("Arabic-Indic digits", "رقمه ٠٩١٢٣٤٥٦٧٨", "رقمه [رقم]");
eq("national number", "الرقم الوطني 12345678901 للمتهم", "الرقم الوطني [رقم] للمتهم");
eq("email", "راسلني على safi.test@example.com رجاءً", "راسلني على [بريد] رجاءً");
eq("name after المدعو", "قام المدعو أحمد محمد علي بسرقة الهاتف", "قام المدعو [اسم] بسرقة الهاتف");
eq("name stops at preposition", "المدعوة فاطمة في السوق", "المدعوة [اسم] في السوق");
eq("name stops at punctuation", "اسمه عثمان، وهو جاري", "اسمه [اسم]، وهو جاري");
eq("name stops at verb", "السيد حسن سرق المال", "السيد [اسم] سرق المال");
eq("name max three words", "المدعو أ ب ج د", "المدعو [اسم] د");

// ── legal meaning is kept
keeps("Sudanese narration without names", "امرأة سرقت هاتف في سوق أم درمان");
keeps("dialect", "زول اتشاكل مع زول في الموقف وضربو بعكاز في راسو");
keeps("article number", "المادة 174 من القانون الجنائي لسنة 1991");
keeps("date", "بتاريخ 2026-10-28 الساعة 10");
keeps("small amount", "أخذ 5000 جنيه من الدرج");
keeps("large amount with currency", "حوّل 1500000000 جنيه إلى حسابه");
keeps("large amount with مبلغ", "استلم مبلغ 250000000 ولم يسلم البضاعة");
keeps("age and duration", "عمره 17 سنة وغاب 6 شهور");
keeps("سيد البيت is not a name cue", "سيد البيت داير يطلعني");
keeps("empty", "");

console.log(`\n${passed}/${passed + failed} passed`);
if (failed) { console.log("SOME FAILED"); process.exit(1); } else console.log("ALL PASSED");
