import Script from "next/script";

/**
 * GA4 for makuria.legal. Uses NEXT_PUBLIC_GA_MEASUREMENT_ID when set,
 * otherwise the owner's existing Makuria property (G-E15JPE39KR, shared
 * with the old makuria.pplx.app site; reports separate the two by hostname).
 * The tag only runs on the production hostname, so Vercel preview and
 * staging traffic never reaches the property.
 */
const DEFAULT_ID = "G-E15JPE39KR";
const PRODUCTION_HOSTS = ["makuria.legal", "www.makuria.legal"];

export function GaScript() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_ID;

  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {`
        (function () {
          if (${JSON.stringify(PRODUCTION_HOSTS)}.indexOf(window.location.hostname) === -1) return;
          var s = document.createElement('script');
          s.async = true;
          s.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';
          document.head.appendChild(s);
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}');
        })();
      `}
    </Script>
  );
}
