// Phase 5 of the legal-agent (spec A7: no professional decision; A8: self-review before delivery).
// Pure logic only. Inputs come from phases 1-4; this module assembles the seven-section memo
// and runs the self-review. A draft that fails self-review is marked not ready.
//
// Sections (spec, approved 2026-11-08):
//   1. الوقائع مع الإحالات        2. المسائل
//   3. الأدلة المؤيدة والمضعِّفة    4. السوابق والنصوص
//   5. البيانات الناقصة            6. ما يحتاج قرار المحامي
//   7. سجل المراجعة الذاتية

import { checkCitation } from "./timeline.mjs";
import { normalizeArabicText } from "./arabic-text.mjs";

export const FINAL_NOTE = "مسودة للمحامي، وليست رأياً نهائياً";

// A7: wording that recommends an option or predicts a result is refused in section 6.
const RECOMMENDATION_WORDING = /أوصي|الأفضل|الأرجح|يُنصح|ننصح|سينجح|سيخسر|الحجة الراجحة|نسبة (?:النجاح|الفوز)/;

function quoteAppears(quote, doc) {
  const q = normalizeArabicText(quote).text;
  return typeof doc.text === "string" && doc.text.includes(q);
}

// Every citation and quote in the memo is re-checked against the index.
// memo: { facts: [{text, cite?}], points: [{text, cite?, quote?}], precedents: [{id, title, label, relevance?, differences?}], ... }
export function selfReview(memo, index) {
  const findings = [];
  const check = (where, cite, quote) => {
    if (!cite) return;
    const r = checkCitation(cite, index);
    if (!r.ok) {
      findings.push({ where, problem: `إحالة لا تُحل: ${r.reason}` });
      return;
    }
    if (quote !== undefined) {
      const doc = index.find((d) => d.id === cite.docId);
      if (!doc.quotableVerbatim) {
        findings.push({ where, problem: "اقتباس من PDF عربي يحتاج مطابقة بالمصدر قبل الاعتماد" });
      } else if (!quoteAppears(quote, doc)) {
        findings.push({ where, problem: "الاقتباس لا يطابق نص المصدر" });
      }
    }
  };

  (memo.facts ?? []).forEach((f, i) => check(`الوقائع ${i + 1}`, f.cite));
  (memo.points ?? []).forEach((p, i) => check(`الأدلة ${i + 1}`, p.cite, p.quote));
  return {
    passed: findings.length === 0,
    checkedAt: new Date().toISOString(),
    findings,
  };
}

// A7 guard for free text that must not carry a recommendation.
function assertNoRecommendation(text, where) {
  if (typeof text === "string" && RECOMMENDATION_WORDING.test(text)) {
    throw new Error(`A7: recommendation wording not allowed in ${where}: "${text}"`);
  }
}

// Builds the memo from the earlier phases' output and runs the self-review.
export function buildMemo(input, index) {
  const facts = input.facts ?? [];
  const decisions = input.lawyerDecisions ?? [];
  for (const d of decisions) {
    assertNoRecommendation(d.question, "section 6");
    (d.options ?? []).forEach((o) => {
      assertNoRecommendation(o.label, "section 6");
      assertNoRecommendation(o.effect, "section 6");
    });
  }

  const memo = {
    sections: {
      facts: facts.map((f) => ({ text: f.text, date: f.date ?? null, status: f.status, cite: f.cite ?? null, reason: f.reason ?? null })),
      issues: input.issues ?? [],
      points: input.points ?? [],
      precedents: input.precedents ?? [],
      gaps: input.gaps ?? [],
      lawyerDecisions: decisions.map((d) => ({ question: d.question, options: d.options ?? [] })),
    },
    facts,
    points: input.points ?? [],
    precedents: input.precedents ?? [],
    finalNote: FINAL_NOTE,
  };

  const review = selfReview(memo, index);
  memo.selfReview = review;
  memo.ready = review.passed;
  return memo;
}
