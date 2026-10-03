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

function stripArabicPunct(text) {
  return text.replace(/[،؛؟.]/g, " ");
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
      // entrustment / legitimate receipt // REVIEW
      [
        "استعار", "استأجر",
        "تسلّم", "تسلم", "استلم",
        "أودع",
        "وكّل", "وكل",
        "سلّمه", "سلمه",
        "عهد",
        "أمانة", "وديعة",
        "يعيده", "يعيدها", "يرده", "يردها",
      ],
      // unlawful disposal // REVIEW
      [
        "باع", "تصرّف", "تصرف", "رهن", "نقل",
        "فرّط", "فرط", "أتلف", "اختلس",
        "بدّد", "بدد", "امتنع",
      ],
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
  const tokens = arabicNormalize(stripArabicPunct(text)).split(/[^؀-ۿA-Za-z0-9]+/).filter(Boolean);
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

// ── Exact port of extraction helpers from analyze.ts ─────────────────────
// These are included here so tests can catch extraction bugs (wrong words
// being blocked or leaking through) without a live DB.

const STOPWORDS = new Set([
  "في", "من", "إلى", "على", "عن", "أن", "إن", "أنه", "أنها", "التي", "الذي",
  "الذين", "و", "أو", "ثم", "قد", "كان", "كانت", "هذا", "هذه", "ذلك", "تلك",
  "لم", "لن", "لا", "ما", "مع", "بين", "عند", "بعد", "قبل", "كل", "بعض",
  "حيث", "حين", "إذا", "كما", "غير", "دون", "إلا", "هو", "هي", "هم", "أنا",
  "نحن", "انت", "انتم", "كانوا", "يكون", "تم", "كذلك", "وقد", "فقد",
]);

const WEAK_TERMS = new Set([
  "المتهم", "متهم", "المتهمة", "المدعي", "المدعى", "المدعية", "عليه", "عليها",
  "الطرف", "الطرفان", "الأطراف", "الشخص", "شخص", "السيد", "المحكمة", "محكمة",
  "القاضي", "الدعوى", "دعوى", "القضية", "قضية", "الحكم", "حكم", "قام", "قامت",
  "دخل", "دخلت", "خرج", "ذهب", "قال", "قالت", "أفاد", "ذكر", "حضر", "طلب",
  "تقدم", "أصدر", "صدر", "يوم", "شهر", "سنة", "تاريخ", "رقم", "مبلغ", "جنيه",
  "الجنيه", "قرش", "أثناء", "خلال", "نحو", "حوالي", "تقريبا", "تقريباً",
  "الوقائع", "وقائع", "الموضوع", "بشأن", "بخصوص", "الحالة", "حالة",
  "أقر", "أنكر", "ادعى", "نفى", "زعم", "أشار", "وصف", "أوضح", "صرّح", "صرح",
  // weak for tokenizer context (bare forms also appear via getBareFormsNormalized)
  "شرطة", "الشرطي", "شرطي",
  // completeness adverbs — no legal meaning as search terms (Fix A)
  "كاملا", "كاملة",
]);

const COMMON_GIVEN_NAMES = new Set([
  "محمد", "أحمد", "احمد", "علي", "عبدالله", "عبد", "إبراهيم",
  "ابراهيم", "الحسن", "حسن", "حسين", "عمر", "عثمان", "يوسف", "إسماعيل",
  "اسماعيل", "خالد", "عبدالرحمن", "عبدالرحيم", "الطيب", "الفاتح", "مصطفى",
  "مصطفي", "صالح", "آدم", "ادم", "بابكر", "التاج", "عوض", "النور", "نور",
  "عبدالعزيز", "الأمين", "الامين", "بشير", "عادل", "ياسر", "طارق", "كمال",
  "مأمون", "مامون", "فاطمة", "عائشة", "عايشة", "خديجة", "مريم", "زينب",
  "آمنة", "امنة", "حواء", "سارة", "هدى", "إيمان", "ايمان", "سلمى", "نعمات",
  "أسماء", "اسماء", "منى", "سعاد", "نجوى", "سمية", "سميه",
]);

function isContentWord(w) {
  if (w.length < 3) return false;
  if (STOPWORDS.has(w)) return false;
  if (WEAK_TERMS.has(w)) return false;
  if (COMMON_GIVEN_NAMES.has(w)) return false;
  if (/^[0-9٠-٩]+$/.test(w)) return false;
  if (/^[وفبكل]/.test(w)) {
    const rest = w.slice(1);
    if (STOPWORDS.has(rest) || WEAK_TERMS.has(rest)) return false;
  }
  if (w.startsWith("ال") && w.length > 3) {
    const rest = w.slice(2);
    if (WEAK_TERMS.has(rest)) return false;
  }
  return true;
}

function tokenize(text) {
  return stripArabicPunct(stripTashkeel(text))
    .split(/[^؀-ۿA-Za-z0-9]+/)
    .filter(Boolean);
}

function stripAttachedPrefix(w) {
  if (w.length < 4) return null;
  if (!/^[وفبكل]/.test(w)) return null;
  const rest = w.slice(1);
  if (rest.length < 3) return null;
  return rest;
}

const CONCEPT_EXPANSIONS = [
  { when: ["وفاة", "وفاته", "وفاتها", "توفي", "توفى", "مات", "ماتت", "مقتل"], add: ["قتل"] },
  { when: ["ضرب", "ضربه", "ضربها", "اعتدى", "اعتداء", "تشاجر", "شجار", "لكم", "طعن"], add: ["أذى", "جرح"] },
  { when: ["دهس", "دهسه", "صدم", "صدمت", "اصطدم", "حادث"], add: ["مركبة", "خطأ"] },
];

function extractTerms(text, max = 12) {
  const words = tokenize(text);
  const freq = new Map();
  for (const w of words) {
    if (!isContentWord(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
    const bare = stripAttachedPrefix(w);
    if (bare && !freq.has(bare) && isContentWord(bare)) freq.set(bare, freq.get(w) ?? 1);
  }
  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);
  const present = new Set(words);
  const expansions = [];
  for (const rule of CONCEPT_EXPANSIONS) {
    if (!rule.when.some(w => present.has(w))) continue;
    for (const add of rule.add) {
      if (!present.has(add) && !expansions.includes(add)) expansions.push(add);
    }
  }
  return [
    ...expansions.map(term => ({ term, origin: "expanded" })),
    ...ranked.map(term => ({ term, origin: "extracted" })),
  ].slice(0, max);
}

// ── CONCEPT_TO_ARTICLES (mirror of analyze.ts) ───────────────────────────

const CONCEPT_TO_ARTICLES = {
  "خيانة الأمانة": [
    { lawSlug: "criminal-law-1991", articleNumber: "177" }, // REVIEW
  ],
  "سرقة": [
    { lawSlug: "criminal-law-1991", articleNumber: "174" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "170" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "172" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "173" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "171" }, // REVIEW
  ],
  "سطو":      [{ lawSlug: "criminal-law-1991", articleNumber: "175" }], // REVIEW
  "تعدٍّ":    [{ lawSlug: "criminal-law-1991", articleNumber: "183" }], // REVIEW
  "اقتحام":   [{ lawSlug: "criminal-law-1991", articleNumber: "183" }], // REVIEW
  "احتيال":   [{ lawSlug: "criminal-law-1991", articleNumber: "178" }], // REVIEW
  "تزوير":    [
    { lawSlug: "criminal-law-1991", articleNumber: "122" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "123" }, // REVIEW
  ],
  "انتحال": [
    { lawSlug: "criminal-law-1991", articleNumber: "113" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "93" },  // REVIEW
  ],
  "إيذاء جسيم": [
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "142" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "143" }, // REVIEW
  ],
  "أذى": [
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "142" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "143" }, // REVIEW
  ],
  "جرح": [
    { lawSlug: "criminal-law-1991", articleNumber: "138" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "139" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "142" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "143" }, // REVIEW
  ],
  "قتل": [
    { lawSlug: "criminal-law-1991", articleNumber: "129" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "130" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "131" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // REVIEW
  ],
  "مخدرات": [
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "15" }, // REVIEW
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "16" }, // REVIEW
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "20" }, // REVIEW
    { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "12" }, // REVIEW
  ],
  "مركبة": [
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "141" }, // REVIEW
  ],
  "خطأ": [
    { lawSlug: "criminal-law-1991", articleNumber: "132" }, // REVIEW
    { lawSlug: "criminal-law-1991", articleNumber: "141" }, // REVIEW
  ],
};

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

  // Pipeline checks: run extractTerms and verify the extracted token pool.
  // extractMust: term must appear in extracted terms (catches filter bugs).
  // extractMustNot: term must NOT appear (catches stopword/weak-term leaks).
  if (expects.extractMust || expects.extractMustNot) {
    const extracted = extractTerms(facts)
      .filter(t => t.origin === "extracted")
      .map(t => t.term);
    for (const term of (expects.extractMust ?? [])) {
      if (!extracted.includes(term)) issues.push(`extracted must include "${term}"`);
    }
    for (const term of (expects.extractMustNot ?? [])) {
      if (extracted.includes(term)) issues.push(`extracted must not include "${term}"`);
    }
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

// ── Breach of trust (3) — compound rule + full extraction pipeline ────────
//
// BT1/BT2 now also run extractTerms so extraction bugs (wrong words blocked
// or leaking) are caught here, not only when testing against a live DB.

// BT1: canonical phrasing — clean facts, no filler.
// Extraction: "باعها" must be a content word (not blocked); "السيارة" clean.
test("BT1", "استعار المتهم سيارة من صاحبها لغرض محدد ثم باعها لشخص آخر دون علم صاحبها",
  {
    inferCriminal: true,
    mustFire: ["خيانة الأمانة"],
    mustNotFire: ["سرقة"],
    extractMust: ["باعها", "سيارة"],
    extractMustNot: ["السيارة،"],  // comma must not attach to a token
  });

// BT2: original failing phrasing with أقر/ولم that previously returned banking
// and constitutional results. Both are stopwords/weak terms and must not appear
// in extracted terms; the compound rule must still fire despite their presence.
test("BT2", "أقر المتهم بأنه استعار سيارة من صاحبها لغرض محدد ثم باعها لطرف ثالث ولم يعد بإعادتها",
  {
    inferCriminal: true,
    mustFire: ["خيانة الأمانة"],
    mustNotFire: ["سرقة"],
    extractMust: ["باعها", "سيارة"],
    extractMustNot: ["أقر", "ولم", "بأنه"],
  });

// BT3: standalone "باع" (3-char verb starting with ب).
// Before the isContentWord fix, rest="اع" had length<3 so the prefix guard
// returned false — "باع" was silently dropped from the candidate pool.
test("BT3", "استلم المتهم البضاعة بموجب الوكالة ثم باع ما ائتمنه عليه الموكل",
  {
    inferCriminal: true,
    mustFire: ["خيانة الأمانة"],
    extractMust: ["باع"],           // regression: 3-char ب-verb must NOT be blocked
    extractMustNot: ["قام"],        // قام ∈ WEAK_TERMS
  });

// ── getCaseTypeSlug port (for gate tests) ────────────────────────────────

function stripTashkeelSimple(t) { return t.replace(/[ً-ِٰ]/g, ""); }

const CASE_TYPE_TO_CATEGORY_TEST = [
  { match: ["جناي", "جريمة", "جرائم", "عقوب"], slug: "criminal" },
  { match: ["مالي", "ضريب", "جمارك", "زكاة", "مصرف", "بنك"], slug: "financial" },
  { match: ["مدني", "عقد", "عقود", "أراضي", "اراضي", "ملكية", "إيجار", "ايجار"], slug: "civil" },
  { match: ["أحوال شخصية", "احوال شخصية", "أسرة", "اسرة", "طلاق", "زواج", "نفقة", "حضانة"], slug: "personal-status" },
  { match: ["تجاري", "شركات", "كمبيال", "إفلاس", "افلاس"], slug: "commercial" },
];

function getCaseTypeSlugTest(caseType) {
  const raw = (caseType ?? "").trim();
  if (!raw) return null;
  const needle = stripTashkeelSimple(raw);
  const hit = CASE_TYPE_TO_CATEGORY_TEST.find(c => c.match.some(m => needle.includes(m)));
  return hit?.slug ?? null;
}

// ── testGate harness ──────────────────────────────────────────────────────
// Verifies the gate-removal fix: applyCriminalExpansions must fire even when
// getCaseTypeSlug returns a non-criminal slug for input.caseType.

function testGate(id, caseTypeInput, factsText, expects) {
  const userSlug = getCaseTypeSlugTest(caseTypeInput);
  const oldGateBlocked = !!userSlug && userSlug !== "criminal";
  const { anyFired, firedRules } = applyCriminalExpansions(factsText);

  const issues = [];
  if (expects.oldGateWouldBlock !== undefined && expects.oldGateWouldBlock !== oldGateBlocked) {
    issues.push(`oldGateWouldBlock: want ${expects.oldGateWouldBlock} got ${oldGateBlocked}`);
  }
  if (expects.anyFiredAfterFix !== undefined && expects.anyFiredAfterFix !== anyFired) {
    issues.push(`anyFired (after fix): want ${expects.anyFiredAfterFix} got ${anyFired}`);
  }
  for (const term of (expects.mustFire ?? [])) {
    if (!firedRules.includes(term)) issues.push(`"${term}" not fired`);
  }
  const ok = issues.length === 0;
  if (ok) passed++; else failed++;
  rows.push({ id, ok, issues: issues.join("; "), fired: firedRules.join("، ") });
}

// ── BT-CAR: failing car case text (full-pipeline check) ──────────────────
//
// This is the case text that broke the pipeline before the concept-map
// architecture: "كاملاً" produced the bare form "املا" via ك-prefix stripping,
// and "دفع" (payment) legitimately passed isContentWord — both dominated law
// retrieval because quick_search_v4 matched noisy results.
//
// Under the new architecture extracted terms are NEVER sent to the law DB,
// so أملا and دفع are irrelevant for law retrieval. The concept-map path
// fetches Art. 177 directly when خيانة الأمانة fires.
const CAR_CASE_TEXT =
  "تسلّم المتهم سيارة المجني عليه كاملاً مقابل اتفاق على دفع أجر أسبوعي " +
  "ثم باعها لطرف ثالث وأغلق هاتفه وقطع الاتصالات فأبلغ صاحب السيارة الشرطة";

test("BT-CAR", CAR_CASE_TEXT, {
  inferCriminal: true,
  mustFire: ["خيانة الأمانة"],
  mustNotFire: ["سرقة", "احتيال"],
  extractMustNot: ["الشرطة", "كاملا", "اmlا"],  // Fix A: كاملاً → كاملا blocked → bare اmlا never generated
});

// ── BT-TRUNC: truncated car-case text (استعار cut to "ار") ─────────────────
//
// This is the exact text that reached the live preview with the first word
// truncated in copy-paste. "استعار" was cut to "ار" (2 chars, no trigger match).
// Fix C (expanded group 1) makes خيانة الأمانة fire via "يعيدها" (entrustment,
// group 1 via 3-char suffix tolerance on trigger "يعيده") + "باع" (disposal).
const CAR_CASE_TRUNCATED =
  "ار أحمد سيارة صديقه خالد لمدة يوم واحد على أن يعيدها مساء اليوم نفسه. " +
  "مرت ثلاثة أيام ولم يُعد أحمد السيارة، وأغلق هاتفه ولم يرد على اتصالات خالد.\n\n" +
  "بعد أسبوع اكتشف خالد أن أحمد باع السيارة لشخص ثالث يُدعى محمد، " +
  "وأن محمد دفع ثمن السيارة كاملًا معتقدًا أن أحمد هو مالكها.\n\n" +
  "تقدم خالد ببلاغ إلى الشرطة. وعند القبض على أحمد، أقر بأنه باع السيارة، " +
  "لكنه دفع بأنه كان مدينًا لخالد بمبلغ مالي، وأن بينهما خلافات مالية سابقة";

test("BT-TRUNC", CAR_CASE_TRUNCATED, {
  inferCriminal: true,
  mustFire: ["خيانة الأمانة"],   // fires via يعيدها (entrustment) + باع (disposal)
  mustNotFire: ["سرقة"],
  extractMustNot: ["كاملا", "اmlا"],  // Fix A: completeness adverb blocked
});

// ── MAP-BT: verify CONCEPT_TO_ARTICLES has the reviewed entries ───────────
// Pure static check — no DB, no expansion rules.

function testMap(id, expects) {
  const issues = [];
  for (const [concept, requiredEntries] of Object.entries(expects.mustHaveAll ?? {})) {
    const entries = CONCEPT_TO_ARTICLES[concept] ?? [];
    for (const { lawSlug, articleNumber } of requiredEntries) {
      if (!entries.some(e => e.lawSlug === lawSlug && e.articleNumber === articleNumber)) {
        issues.push(`CONCEPT_TO_ARTICLES["${concept}"] missing {${lawSlug}, Art.${articleNumber}}`);
      }
    }
  }
  const ok = issues.length === 0;
  if (ok) passed++; else failed++;
  rows.push({ id, ok, issues: issues.join("; "), fired: "" });
}

testMap("MAP-BT", {
  mustHaveAll: {
    "خيانة الأمانة": [{ lawSlug: "criminal-law-1991", articleNumber: "177" }],
    "سرقة": [
      { lawSlug: "criminal-law-1991", articleNumber: "174" },
      { lawSlug: "criminal-law-1991", articleNumber: "171" },
    ],
    "مخدرات": [
      { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "15" },
      { lawSlug: "narcotics-psychotropic-substances-act-1994", articleNumber: "12" },
    ],
    "مركبة": [{ lawSlug: "criminal-law-1991", articleNumber: "132" }],
    "إيذاء جسيم": [
      { lawSlug: "criminal-law-1991", articleNumber: "138" },
      { lawSlug: "criminal-law-1991", articleNumber: "142" },
    ],
  },
});

// ── Gate-removal tests (issue: criminal path skipped due to caseType) ─────
//
// Root cause of the live failure: input.caseType = "مالية" →
//   getCaseTypeSlug returns "financial" →
//   applyCriminalGate = false → criminal expansion never ran →
//   caseTypeFull.slug = "financial" → criminal path skipped →
//   "دفع" drove results (Central Bank Act, Arbitration Act).
//
// Fix: remove the gate, always run applyCriminalExpansions.
// If anyFired → pass undefined caseType to resolveCaseTypeFull so it
// resolves to "criminal" regardless of the user-supplied label.

// Car case text as actually submitted on the live preview (with money words).
const CAR_CASE_FULL =
  "تسلّم المتهم سيارة المجني عليه كاملاً مقابل دفع أجر أسبوعي ثم باعها " +
  "لطرف ثالث وكانت بينهما خلافات مالية وأصبح المتهم مديناً للمجني عليه";

// GT1: caseType="مالية" — old gate would have blocked; fix ensures concept fires.
testGate("GT1", "مالية", CAR_CASE_FULL, {
  oldGateWouldBlock: true,    // "مالي" in "مالية" → "financial" → gate blocked
  anyFiredAfterFix: true,     // gate removed → concept fires
  mustFire: ["خيانة الأمانة"],
});

// GT2: empty caseType — gate was already open (regression guard).
testGate("GT2", "", CAR_CASE_FULL, {
  oldGateWouldBlock: false,
  anyFiredAfterFix: true,
  mustFire: ["خيانة الأمانة"],
});

// GT3: explicit criminal caseType — gate was already open (regression guard).
testGate("GT3", "جريمة مالية", CAR_CASE_FULL, {
  oldGateWouldBlock: false,   // "جريمة" matches "criminal" → gate was open
  anyFiredAfterFix: true,
  mustFire: ["خيانة الأمانة"],
});

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
 * ── Breach-of-trust car case (BT1 / BT2 / BT3) ──────────────────────────────
 *
 * All three should produce (against live DB):
 *   result.noConfidentMatch === false    (خيانة الأمانة returns in-scope results)
 *   result.laws[0] matched by "خيانة الأمانة"
 *   result.laws — no item whose lawSlug matches /bank|central|constitution/i
 *   result.cases — no item whose title or citation matches /bank|constitution/i
 *
 * BT2 specifically tests the stopword regression: "أقر" and "ولم" must NOT
 * appear in result.issues (filtered before the search stage).
 * BT3 specifically tests the Bug-1 regression: "باع" (3-char ب-verb) must
 * appear as an extracted term and must not be blocked by the prefix check.
 *
 * The gate (noConfidentMatch) is only triggered when the case type was resolved
 * AND no result from the primary category was matched by a concept term.
 * Companion-law articles matched only by extracted terms do not count.
 */
