import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Served at /robots.txt.
 *
 * Everything public is crawlable. The disallow list is only: authenticated
 * areas (nothing there renders for a crawler anyway) and /search — Google's
 * own guidance is to keep internal search-result pages out of the index,
 * because they duplicate the law and case pages they link to.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/workspace",
          "/matters",
          "/alerts",
          "/search",
          // «قيد التطوير» placeholders. Indexing a page whose entire content is
          // "coming soon" is the same thin-content problem as the empty laws:
          // it costs the whole domain, not just the URL. They come back in once
          // the modules are built. Nothing in the site navigation links to them,
          // so a crawl block is enough and no per-page noindex is needed.
          "/quick-check",
          "/practical-law",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
