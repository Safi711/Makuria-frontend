import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The advisor moved from /case-mapper to /abu-rannat on 2026-10-12.
      // Permanent (308) so search engines move the old URL's standing to the
      // new one. Query strings pass through unchanged, so a shared analysis
      // link (/case-mapper?facts=…&submitted=1) opens the same analysis.
      {
        source: "/case-mapper",
        destination: "/abu-rannat",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
