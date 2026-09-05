import Script from "next/script";

/**
 * Loads GA4 only if NEXT_PUBLIC_GA_MEASUREMENT_ID is set for this
 * deployment. Deliberately not hardcoded — see Phase 0.6 report
 * section G for why the production property's ID should not be reused
 * as-is for staging traffic.
 */
export function GaScript() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
