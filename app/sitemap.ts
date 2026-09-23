import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site";

// Regenerated once a day. The corpus changes when laws are added or a status
// is corrected, not per request, so a daily rebuild keeps the sitemap honest
// without querying the database on every crawl.
export const revalidate = 86400;

/**
 * A read-only client with no cookie handling: the sitemap is public data and
 * must not depend on a request's session (that would force it dynamic).
 * RLS still applies — it sees exactly what an anonymous visitor sees.
 */
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function entry(
  path: string,
  lastModified?: string | null,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
  priority = 0.5
): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${path}`,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    entry("/", null, "daily", 1),
    entry("/laws", null, "daily", 0.9),
    entry("/cases", null, "daily", 0.9),
    entry("/principles", null, "weekly", 0.7),
    // /case-mapper is a working module. /practical-law and /quick-check are
    // «قيد التطوير» placeholders and are deliberately absent — see app/robots.ts.
    entry("/case-mapper", null, "monthly", 0.5),
  ];

  const supabase = publicClient();
  // No credentials at build time (e.g. a bare CI check): still emit a valid
  // sitemap of the static routes rather than failing the build.
  if (!supabase) return staticRoutes;

  const [laws, cases, principles] = await Promise.all([
    supabase
      .from("laws")
      .select("slug, updated_at, status, total_articles")
      .neq("status", "draft")
      .not("slug", "is", null)
      // 28 of the 108 laws are title-only records whose text has not been
      // extracted yet. Submitting empty pages invites a thin-content
      // judgement that costs the whole domain, not just those URLs. They
      // rejoin the sitemap by themselves once their articles land, because
      // this is regenerated daily.
      .gt("total_articles", 0)
      .limit(2000),
    supabase
      .from("cases")
      .select("slug, updated_at")
      .eq("status", "published")
      .not("slug", "is", null)
      .limit(5000),
    supabase
      .from("legal_principles")
      .select("slug, updated_at")
      .not("slug", "is", null)
      .limit(1000),
  ]);

  // Fail loudly rather than shipping a truncated sitemap: a silent fallback
  // would hand Google 7 URLs instead of ~340 and cache that for a day, which
  // is worse than a build that stops and says why. Missing credentials are
  // handled above; reaching this point means the database itself refused.
  //
  // Only laws and cases are treated as fatal — they are the corpus. The
  // handful of principles are reachable from /principles regardless, so
  // losing them is not worth blocking a deployment over.
  const fatal = [
    laws.error && `laws: ${laws.error.message}`,
    cases.error && `cases: ${cases.error.message}`,
  ].filter(Boolean);
  if (fatal.length > 0) {
    throw new Error(`sitemap: could not read the corpus — ${fatal.join("; ")}`);
  }

  const lawEntries = (laws.data ?? [])
    // site-migration-notice is an internal record, not a law anyone should land on.
    .filter((l) => l.slug && l.slug !== "site-migration-notice")
    .map((l) =>
      entry(
        `/laws/${l.slug}`,
        l.updated_at,
        "monthly",
        // A law in force is the page a searcher most likely wants; repealed and
        // reference texts stay in the index but rank below it.
        l.status === "active" || l.status === "published" ? 0.8 : 0.6
      )
    );

  const caseEntries = (cases.data ?? []).map((c) =>
    entry(`/cases/${c.slug}`, c.updated_at, "monthly", 0.7)
  );

  const principleEntries = (principles.data ?? []).map((p) =>
    entry(`/principles/${p.slug}`, p.updated_at, "monthly", 0.6)
  );

  return [...staticRoutes, ...lawEntries, ...caseEntries, ...principleEntries];
}
