import { Locale } from "@/lib/i18n";

/**
 * RETIRED — 2026-09-28, by Safi's decision: the site shows legal force
 * («ساري» / «ملغى» / «تحت المراجعة») and the source of the text. It no longer
 * shows a «موثّق / غير موثّق» stamp.
 *
 * Why the stamp had to go, in the words of what it actually did:
 *
 *  - It told the reader whether someone had ticked a box in the database, not
 *    where the text came from. Those are different questions, and only the
 *    second one is a lawyer's question.
 *  - It read «غير موثّق» on the Traffic Act 2010 on the day its full official
 *    text had just been loaded from the Ministry of Justice, article by
 *    article, each one checked against a hash.
 *  - It read «موثّق» on six records that held no text at all — the
 *    Anti-Human-Trafficking Act 2014 among them, a title and nothing else,
 *    stamped as verified on a public page.
 *  - Its own label collided with the legal-force label: both rendered
 *    «تحت المراجعة», so a repealed law and an unchecked record looked
 *    identical.
 *
 * The component is emptied rather than deleted **on purpose**. Pages in this
 * repository no longer import it, but the build running in production still
 * renders the badge on `/laws` — meaning some deployed page imports it from a
 * version of that file we do not hold. Returning null removes the badge from
 * every page that imports it, whichever those turn out to be, without needing
 * to find and edit each one. Deleting the file instead would break that page's
 * build.
 *
 * The props are kept so that no caller has to change.
 */
export function VerificationBadge(_props: { verified: boolean; locale: Locale }) {
  return null;
}
