/** Candidate cleaner for the rewrite (diag only, not wired in).
 * Drops markdown headings and the model's own "branch of law" labels, and
 * removes bold markers. Facts lines are kept as written. */
export function cleanRewrite(t) {
  return (t ?? "")
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .filter((l) => !/^\s*\**\s*(ال)?(فرع|تصنيف|نوع القانون|القانون المختص)/.test(l))
    .map((l) => l.replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .join("\n");
}
