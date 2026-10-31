/**
 * Semantic search over the Makuria corpus (Phase 1, step 2).
 *
 * facts → (redactPII) → short formal legal restatement (Haiku)
 *       → voyage-4 query embedding → match_articles_v2 (top 40, no repealed,
 *         no cyber-crimes-2007) → Voyage rerank-2.5 → top N.
 *
 * Measured on the 30 approved cases: correct article in the top 5 for 26/29 (90%).
 * Any failure (missing key, network, timeout) returns null so the caller can
 * fall back to the existing text search — this module never throws.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { redactPII } from "./redact-pii.mjs";

export type SemanticHit = {
  articleId: string;
  lawSlug: string;
  lawTitle: string;
  articleNumber: string | null;
  titleAr: string | null;
  contentAr: string;
  legalStatus: string | null;
  similarity: number;
  rerankScore: number;
};

const POOL = 40;
const TIMEOUT_MS = 12000;

const REWRITE_SYSTEM = `أنت مساعد بحث قانوني في التشريع السوداني. تصلك وقائع كما يرويها شخص عادي، وقد تكون بالعامية السودانية.
أعد صياغتها في جملتين أو ثلاث بالعربية الفصحى القانونية، تصف: نوع العلاقة أو الفعل، والمسألة القانونية المطروحة، وفرع القانون الأقرب (جنائي، معاملات مدنية، إيجار مباني، عمل، مرور، خدمة مدنية، حكم محلي...).
لا تذكر أرقام مواد، ولا تحكم بثبوت شيء، ولا تضف وقائع غير موجودة. أخرج الصياغة فقط.`;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

async function rewriteFacts(facts: string, anthropicKey: string): Promise<string> {
  const j = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      temperature: 0,
      system: REWRITE_SYSTEM,
      messages: [{ role: "user", content: facts }],
    },
  );
  return (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").trim();
}

export async function semanticSearch(
  supabase: SupabaseClient,
  rawFacts: string,
  topN = 5,
): Promise<{ hits: SemanticHit[]; rewrite: string } | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const voyageKey = process.env.VOYAGE_API_KEY ?? "";
  if (!anthropicKey || !voyageKey) {
    console.error(`[semantic_search] skipped: missing ${!voyageKey ? "VOYAGE_API_KEY" : "ANTHROPIC_API_KEY"}`);
    return null;
  }
  try {
    // Names, phone and ID numbers never leave the server.
    const facts = redactPII(rawFacts);
    const rewrite = await rewriteFacts(facts, anthropicKey);
    const query = rewrite ? `${rewrite}\n${facts}` : facts;

    const voyageH = { Authorization: `Bearer ${voyageKey}` };
    // Shape check only (length and prefix) — never the key itself.
    if (!/^pa-[A-Za-z0-9_-]{20,}$/.test(voyageKey)) {
      console.error(`[semantic_search] VOYAGE_API_KEY looks wrong: length=${voyageKey.length} starts_with_pa=${voyageKey.startsWith("pa-")} has_space=${/\s/.test(voyageKey)}`);
    }
    const emb = await postJson("https://api.voyageai.com/v1/embeddings", voyageH, {
      input: [query], model: "voyage-4", input_type: "query", output_dimension: 1024,
    });
    const vec: number[] = emb.data[0].embedding;

    const { data, error } = await supabase.rpc("match_articles_v2", {
      p_embedding: `[${vec.join(",")}]`,
      p_count: POOL,
    });
    if (error || !data?.length) {
      console.error(`[semantic_search] match_articles_v2: ${error?.message ?? "no rows"}`);
      return null;
    }
    type Row = {
      article_id: string; law_slug: string; law_title: string; article_number: string | null;
      title_ar: string | null; content_ar: string | null; legal_status: string | null; similarity: number;
    };
    const rows = data as Row[];

    const docs = rows.map((r) =>
      `${r.law_title} — المادة ${r.article_number ?? ""}${r.title_ar ? ` (${r.title_ar})` : ""}\n${r.content_ar ?? ""}`);
    const rr = await postJson("https://api.voyageai.com/v1/rerank", voyageH, {
      query, documents: docs, model: "rerank-2.5", top_k: Math.min(topN, rows.length),
    });

    const hits: SemanticHit[] = (rr.data as Array<{ index: number; relevance_score: number }>).map((d) => {
      const r = rows[d.index];
      return {
        articleId: r.article_id, lawSlug: r.law_slug, lawTitle: r.law_title,
        articleNumber: r.article_number, titleAr: r.title_ar, contentAr: r.content_ar ?? "",
        legalStatus: r.legal_status, similarity: r.similarity, rerankScore: d.relevance_score,
      };
    });
    return { hits, rewrite };
  } catch (e) {
    // Error text only — never the facts.
    console.error(`[semantic_search] failed: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    return null;
  }
}
