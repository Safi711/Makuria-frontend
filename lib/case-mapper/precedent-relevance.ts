/** Precedent relevance classifier — keyword/tag vs. concept-map matching. */

export type RelevanceOutcome = "direct" | "conditional" | "hidden" | "unindexed";

export type PrecedentRelevance =
  | { outcome: "direct"; concept: string; via: string }
  | { outcome: "conditional"; concept: string; via: string }
  | { outcome: "hidden" }
  | { outcome: "unindexed" };

export type ConceptEntry = { direct: string[]; conditional: string[] };
export type ConceptMap = {
  concepts: Record<string, { alias?: string; direct?: string[]; conditional?: string[] }>;
};

function arabicNormalize(text: string): string {
  // strip tashkeel U+064B–U+065F + U+0670; fold alef variants
  return text.replace(/[ً-ٰٟ]/g, "").replace(/[أإآٱ]/g, "ا");
}

function resolveEntry(key: string, map: ConceptMap): ConceptEntry | null {
  const seen = new Set<string>();
  let cur = key;
  while (true) {
    if (seen.has(cur)) return null;
    seen.add(cur);
    const entry = map.concepts[cur];
    if (!entry) return null;
    if (entry.alias) { cur = entry.alias; continue; }
    return { direct: entry.direct ?? [], conditional: entry.conditional ?? [] };
  }
}

/**
 * Classify a single case against all active concepts.
 *
 * @param caseKwTags  Combined keywords + tags of the DB case row.
 * @param activeConcepts  Keys from the concept map that the engine fired
 *   (union of criminalTerms[].term and discussConcepts[]).
 * @param map  The parsed precedent-concept-map.json object.
 */
export function classifyPrecedent(
  caseKwTags: string[],
  activeConcepts: string[],
  map: ConceptMap
): PrecedentRelevance {
  if (caseKwTags.length === 0) return { outcome: "unindexed" };

  const normKws = caseKwTags.map((k) => arabicNormalize(k.trim()));

  let best: PrecedentRelevance = { outcome: "hidden" };

  for (const concept of activeConcepts) {
    const entry = resolveEntry(concept, map);
    if (!entry) continue;

    const normDirect = entry.direct.map((d) => arabicNormalize(d));
    const normCond = entry.conditional.map((c) => arabicNormalize(c));

    // DIRECT: any case kw/tag normalises to a direct term
    for (let i = 0; i < normKws.length; i++) {
      if (normDirect.includes(normKws[i])) {
        return { outcome: "direct", concept, via: caseKwTags[i] };
      }
    }

    // CONDITIONAL: case has a conditional item AND at least one direct item
    if (normCond.length > 0) {
      const condIdx = normKws.findIndex((k) => normCond.includes(k));
      const directIdx = normKws.findIndex((k) => normDirect.includes(k));
      if (condIdx !== -1 && directIdx !== -1) {
        if (best.outcome === "hidden") {
          best = { outcome: "conditional", concept, via: caseKwTags[condIdx] };
        }
      }
    }
  }

  return best;
}
