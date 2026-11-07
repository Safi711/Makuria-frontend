export type PrincipleRow = { id: string; title_ar: string | null; summary_ar: string | null; category: string | null; slug: string | null };
export function foldWord(w: string): string;
export function keyWords(text: string | null | undefined): string[];
export function matchPrinciples<T extends PrincipleRow>(articleTitles: string[], principles: T[], max?: number): T[];
