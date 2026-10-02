/**
 * Expansion matching tests — pure port of the logic in analyze.ts.
 * No DB, no imports. Run: node lib/case-mapper/__tests__/expansions.test.mjs
 *
 * 22 Arabic narrative sentences written the way ordinary Sudanese people
 * describe facts — with conjunctions glued to verbs, words between phrase
 * parts, alef variants, and pronominal suffixes on verbs — to confirm that
 * the expansion rules fire (or stay silent) correctly.
 */

// ── Exact port of pure helpers from analyze.ts ────────────────────────────

function stripTashkeel(text) {
  return text.replace(/[ً-ْٰ]/g, "");
}

function arabicNormalize(text) {
  return stripTashkeel(text).replace(/[أإآٱ]/g, "ا");
}

function getBareFormsNormalized(rawToken) {
  const n = arabicNormalize(rawToken);
  const s = new Set([n]);
  let t = n;
  if (t.startsWith("ال") && t.length > 3) { t = t.slice(2); s.add(t); }
  if (/^[وفبلك]/.test(t) && t.length > 2) {
    const stripped1 = t.slice(1);
    s.add(stripped1);
    if (stripped1.startsWith("ال") && stripped1.length > 3) s.add(stripped1.slice(2));
  }
  return s;
}

function tokenMatchesTrigger(textToken, triggerWord) {
  return getBareFormsNormalized(textToken).has(arabicNormalize(triggerWord));
}

function tokenMatchesTriggerOrPrefix(textToken, triggerWord) {
  const normTrigger = arabicNormalize(triggerWord);
  if (normTrigger.length < 3) return false;
  for (const bare of getBareFormsNormalized(textToken)) {
    if (bare === normTrigger) return true;
    if (bare.startsWith(normTrigger) && bare.length <= normTrigger.length + 3) return true;
  }
  return false;
}

function windowContainsAll(tokens, triggerWords, windowSize) {
  if (triggerWords.length === 0) return false;
  for (let i = 0; i < tokens.length; i++) {
    const win = tokens.slice(i, i + windowSize);
    if (triggerWords.every(tw => win.some(t => tokenMatchesTrigger(t, tw)))) return true;
  }
  return false;
}

const EXPANSION_PROXIMITY_WINDOW = 6;

const DWELLING_WORDS = [
  "منزل", "بيت", "دار", "شقة", "محل", "مبنى", "مسكن", "غرفة",
  "عمارة", "مخزن", "مستودع",
];

const CRIMINAL_VOCABULARY_EXPANSIONS = [
  {
    label: "theft",
    when: ["أخذ", "استولى", "انتزع", "سلب", "نشل", "اختلس", "سرق", "سرقة", "سطا", "يسرق"],
    add: ["سرقة"],
  },
  {
    label: "robbery",
    when: ["سطو", "أرغمه", "بتهديد السلاح", "تهديد بسلاح", "بالقوة والتهديد"],
    add: ["سطو", "سرقة"],
  },
  {
    label: "trespass",
    when: [
      "اقتحم", "اقتحمه", "اقتحمها", "تسلل", "تسوّر", "تسور",
      "دخل بغير إذن", "دخل بدون إذن", "دخل المنزل بغير", "دخل البيت بغير",
      "دخل منزله قسراً", "دخل منزله بالقوة", "كسر الباب", "كسر قفل",
    ],
    add: ["تعدٍّ", "اقتحام"],
  },
  {
    label: "fraud",
    when: [
      "خدع", "غرّر", "غرر", "احتال", "أوهم", "خادع", "تغرير",
      "ادعى ملكية", "باع ما لا يملك", "باع أرضاً لا يملكها",
      "باع أرض لا يملكها", "ادعى أنه مالك", "تظاهر بأنه مالك",
    ],
    add: ["احتيال"],
  },
  {
    label: "forgery",
    when: [
      "زوّر", "زور", "حرّف", "حرف", "زيّف", "زيف",
      "انتحل", "انتحل صفة", "تظاهر بأنه", "ادعى أنه", "انتحال صفة",
    ],
    add: ["تزوير", "انتحال"],
  },
  {
    label: "grievous_hurt",
    when: [
      "كسر يده", "كسر ذراعه", "كسر رجله", "كسر أسنانه",
      "فقأ عينه", "طعنه بسكين", "طعنه بالسكين", "جرح بليغ", "إيذاء جسيم",
    ],
    add: ["إيذاء جسيم"],
  },
  {
    label: "drugs",
    when: [
      "مخدر", "مخدرات", "حشيش", "أفيون", "هيروين", "قات", "بانجو",
      "كوكايين", "مواد مخدرة", "حيازة مخدرات", "تجارة مخدرات",
      "ترويج مخدرات", "تهريب مخدرات",
    ],
    add: ["مخدرات"],
  },
];

const COMPOUND_CRIMINAL_EXPANSIONS = [
  {
    label: "breach_of_trust",
    allOf: [
      ["استعار", "تسلّم", "تسلم", "استلم", "أودع", "وكّل", "وكل", "سلّمه", "سلمه", "عهد"],
      ["باع", "تصرّف", "تصرف", "رهن", "نقل", "فرّط", "فرط", "أتلف", "اختلس"],
    ],
    add: ["خيانة الأمانة"],
  },
  {
    label: "fiduciary_misappropriation",
    allOf: [
      ["أمين", "وديعة", "مستأمن", "وكيل", "أمانة"],
      ["اختلس", "استغل", "حوّل", "حول", "أنفق"],
    ],
    add: ["خيانة الأمانة"],
  },
];

function applyCriminalExpansions(text) {
  const tokens = arabicNormalize(text).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
  const out = [];
  const added = new Set();
  let anyFired = false;

  for (const rule of CRIMINAL_VOCABULARY_EXPANSIONS) {
    const fires = rule.when.some(w =>
      windowContainsAll(tokens, w.split(/\s+/), EXPANSION_PROXIMITY_WINDOW)
    );
    if (!fires) continue;
    anyFired = true;
    for (const t of rule.add) {
      if (!added.has(t)) { added.add(t); out.push({ term: t, origin: "expanded" }); }
    }
  }

  const trespassAlreadyFired = added.has("تعدٍّ") || added.has("اقتحام");
  if (!trespassAlreadyFired) {
    const firesViaDwelling = DWELLING_WORDS.some(dw =>
      windowContainsAll(tokens, ["دخل", dw], EXPANSION_PROXIMITY_WINDOW)
    );
    if (firesViaDwelling) {
      anyFired = true;
      for (const t of ["تعدٍّ", "اقتحام"]) {
        if (!added.has(t)) { added.add(t); out.push({ term: t, origin: "expanded" }); }
      }
    }
  }

  // Compound rules: all groups must fire anywhere in text (no proximity window)
  for (const rule of COMPOUND_CRIMINAL_EXPANSIONS) {
    const fires = rule.allOf.every(group =>
      group.some(trigger =>
        tokens.some(t => tokenMatchesTriggerOrPrefix(t, trigger))
      )
    );
    if (!fires) continue;
    anyFired = true;
    for (const t of rule.add) {
      if (!added.has(t)) { added.add(t); out.push({ term: t, origin: "expanded" }); }
    }
  }

  return { terms: out, anyFired, firedRules: [...added] };
}

// ── Test harness ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const rows = [];

function test(id, facts, expects) {
  const { anyFired, firedRules } = applyCriminalExpansions(facts);
  const issues = [];

  if (expects.inferCriminal !== anyFired) {
    issues.push(`inferCriminal: want ${expects.inferCriminal} got ${anyFired}`);
  }
  for (const term of (expects.mustFire ?? [])) {
    if (!firedRules.includes(term)) issues.push(`"${term}" not fired`);
  }
  for (const term of (expects.mustNotFire ?? [])) {
    if (firedRules.includes(term)) issues.push(`"${term}" fired unexpectedly`);
  }

  const ok = issues.length === 0;
  if (ok) passed++; else failed++;
  rows.push({ id, ok, issues: issues.join("; "), fired: firedRules.join("، ") });
}

// ── TEST CASES ────────────────────────────────────────────────────────────

// ── Theft (6) — وأخذ with attached waw, various theft verbs ──────────────

test("T1", "دخل شخص منزل جاره أثناء غيابه بدون إذن وأخذ هاتفاً محمولاً ومبلغاً من المال",
  // وأخذ → stripped to أخذ → theft; دخل + منزل within 6 → trespass
  { inferCriminal: true, mustFire: ["سرقة", "تعدٍّ", "اقتحام"] });

test("T2", "استولى المتهم على محفظة نقود من حقيبة الضحية في السوق",
  { inferCriminal: true, mustFire: ["سرقة"] });

test("T3", "نشل المتهم محفظة الضحية من جيب ملابسه في السوق بسرعة وجرى هارباً",
  { inferCriminal: true, mustFire: ["سرقة"] });

test("T4", "سرق شخص دراجة نارية كانت مركونة أمام منزل صاحبها ليلاً",
  { inferCriminal: true, mustFire: ["سرقة"] });

test("T5", "اختلس المتهم مبالغ مالية من صندوق الشركة على مدار عدة أشهر",
  { inferCriminal: true, mustFire: ["سرقة"] });

test("T6", "انتزع الجاني الهاتف من يد الضحية بالقوة وجرى هارباً نحو الحي",
  { inferCriminal: true, mustFire: ["سرقة"] });

// ── Trespass (4) — اقتحم, تسلل, دخل+dwelling, waw on دخل ────────────────

test("TR1", "اقتحم المتهم بيت جاره في الليل وأخذ ما وجده من مال",
  // اقتحم → trespass; وأخذ → theft
  { inferCriminal: true, mustFire: ["تعدٍّ", "اقتحام", "سرقة"] });

test("TR2", "تسلل المتهم إلى داخل الشقة عبر النافذة وسرق المجوهرات والنقود",
  // تسلل → trespass; سرق → theft
  { inferCriminal: true, mustFire: ["تعدٍّ", "اقتحام", "سرقة"] });

test("TR3", "دخل المتهم منزل زميله بغير علمه وأخذ لاب توب ثمين من الغرفة",
  // دخل+منزل (window 2) → trespass dwelling-rule; وأخذ → theft
  { inferCriminal: true, mustFire: ["تعدٍّ", "اقتحام", "سرقة"] });

test("TR4", "دخل الشخص دار المجني عليه دون إذن وعبث بمحتوياته دون أن يأخذ شيئاً",
  // دخل+دار → trespass; no theft verb
  { inferCriminal: true, mustFire: ["تعدٍّ", "اقتحام"], mustNotFire: ["سرقة"] });

// ── Fraud / Forgery (4) — attached prefixes, alef variants, phrases ───────

test("F1", "احتال المتهم على المشتري وأخذ منه ثمن سيارة وهمية لا وجود لها",
  { inferCriminal: true, mustFire: ["احتيال"] });

test("F2", "خدع المتهم الضحية وأقنعه بشراء أرض يملكها غيره بحجج كاذبة",
  { inferCriminal: true, mustFire: ["احتيال"] });

test("F3", "باع المتهم أرضاً لا يملكها لعدة أشخاص وأخذ الثمن منهم جميعاً",
  // "باع أرضاً لا يملكها" words within 6-token window
  { inferCriminal: true, mustFire: ["احتيال"] });

test("F4", "زوّر المتهم عقد بيع الأرض وباعها لشخص آخر بسعر أعلى من قيمتها",
  // زوّر → stripped tashkeel → زور → forgery; shadda stripped by stripTashkeel
  { inferCriminal: true, mustFire: ["تزوير", "انتحال"] });

// ── Assault / grievous hurt (3) — waw on كسر, phrase with gap ────────────

test("A1", "اعتدى المتهم على جاره وكسر يده اليمنى بضربة عصا قوية",
  // كسر+يده within window (وكسر stripped → كسر)
  { inferCriminal: true, mustFire: ["إيذاء جسيم"] });

test("A2", "طعنه بسكين في الظهر فنقل إلى المستشفى في حالة حرجة",
  // طعنه+بسكين within window
  { inferCriminal: true, mustFire: ["إيذاء جسيم"] });

test("A3", "ضربه بعصا وكسر ذراعه الأيسر وتركه ينزف في الشارع",
  // وكسر stripped → كسر; كسر+ذراعه within 6
  { inferCriminal: true, mustFire: ["إيذاء جسيم"] });

// ── Breach of trust (2) — car borrowed then sold, with and without أقر/ولم ─

// BT1: canonical phrasing — clean facts text, no filler words
test("BT1", "استعار المتهم سيارة من صاحبها لغرض محدد ثم باعها لشخص آخر دون علم صاحبها",
  // استعار → Group A; باعها → باع via prefix-match (3-char suffix ها) → Group B → خيانة الأمانة
  // No theft verb present so سرقة must NOT fire
  { inferCriminal: true, mustFire: ["خيانة الأمانة"], mustNotFire: ["سرقة"] });

// BT2: original failing phrasing — includes أقر and ولم which previously leaked
// through isContentWord and returned Central Bank Act and constitutional articles.
// After the stopword fix both are filtered and the compound rule still fires.
test("BT2", "أقر المتهم بأنه استعار سيارة من صاحبها لغرض محدد ثم باعها لطرف ثالث ولم يعد بإعادتها",
  { inferCriminal: true, mustFire: ["خيانة الأمانة"], mustNotFire: ["سرقة"] });

// ── Civil cases — must NOT infer criminal, no criminal terms ──────────────

test("C1", "فسخ المشتري العقد بسبب عدم تسليم البضاعة في الموعد المتفق عليه",
  { inferCriminal: false, mustNotFire: ["سرقة", "تعدٍّ", "احتيال", "تزوير"] });

test("C2", "رفض المؤجر تجديد عقد الإيجار وطلب إخلاء الشقة خلال ثلاثة أشهر",
  // "الشقة" is a dwelling word but there is no "دخل" → trespass must NOT fire
  { inferCriminal: false, mustNotFire: ["سرقة", "تعدٍّ", "اقتحام", "احتيال"] });

test("C3", "نزاع على ملكية قطعة أرض زراعية بين ثلاثة ورثة بعد وفاة والدهم",
  // "وفاة" is in CONCEPT_EXPANSIONS (generic death mapping) but NOT in
  // CRIMINAL_VOCABULARY_EXPANSIONS, so no criminal rule fires here.
  { inferCriminal: false, mustNotFire: ["سرقة", "تعدٍّ", "احتيال", "تزوير"] });

// ── Results table ─────────────────────────────────────────────────────────

const W = 8;
console.log(`\n${"ID".padEnd(5)} ${"PASS".padEnd(5)} ${"Fired terms".padEnd(35)} Notes`);
console.log("─".repeat(80));
for (const r of rows) {
  const status = r.ok ? "PASS" : "FAIL";
  const fired = r.fired || "(none)";
  const notes = r.ok ? "" : r.issues;
  console.log(`${r.id.padEnd(5)} ${status.padEnd(5)} ${fired.padEnd(35)} ${notes}`);
}
console.log("─".repeat(80));
console.log(`\nTotal: ${passed + failed}  Passed: ${passed}  Failed: ${failed}\n`);

if (failed > 0) process.exit(1);

/*
 * ── Integration expectations (require live DB — not runnable here) ──────────
 *
 * Test case: theft from a neighbour's house
 *   Facts: دخل شخص منزل جاره أثناء غيابه بدون إذن وأخذ هاتفاً محمولاً
 *          ومبلغاً من المال
 *   Case type: جنائي (criminal)
 *
 * Expansion rules that fire: سرقة (theft trigger: وأخذ → أخذ)
 *                             تعدٍّ / اقتحام (dwelling trigger: دخل + منزل)
 *
 * Expected article ranking (top 4):
 *   1. Criminal Act Art. 174 — "جريمة السرقة" offence-defining article for سرقة
 *   2. Criminal Act Art. 183 — criminal trespass, offence-defining for اقتحام
 *   3. Criminal Act Art. 170 — hadd theft (in-scope, contains سرقة)
 *   4. Criminal Act Art. 172 — when hadd falls (in-scope, contains سرقة)
 *
 * Arts 1–5 of the Criminal Act (تعريفات) must appear AFTER arts 170–184 when
 * any substantive in-scope article is present; Art. 3 (general definitions)
 * should not be in the top 5.
 *
 * Expected case ranking: cases whose excerpt/principle_ar explicitly mentions
 * "سرقة" or "اقتحام" should precede cases whose only connection is sharing the
 * criminal category_id.
 *
 * These expectations are verified manually against live Supabase responses.
 *
 * ── Breach-of-trust car case (BT1 / BT2) ────────────────────────────────────
 *
 * Both BT1 and BT2 should produce (against live DB):
 *   result.noConfidentMatch === false    (خيانة الأمانة returns in-scope results)
 *   result.laws[0] matched by "خيانة الأمانة"
 *   result.laws — no item whose lawSlug matches /bank|central|constitution/i
 *   result.cases — no item whose title or citation matches /bank|constitution/i
 *
 * BT2 specifically tests the stopword regression: the terms "أقر" and "ولم"
 * must NOT appear in result.issues (they are filtered before the search stage).
 */
