/**
 * Renders a ts_headline() result (StartSel=<mark>, StopSel=</mark>) as
 * React nodes without dangerouslySetInnerHTML — split on the tags rather
 * than injecting raw HTML, so this never becomes an XSS vector even
 * though the source is trusted, server-generated corpus text.
 */
export function Highlight({ html }: { html: string }) {
  if (!html) return null;
  const parts = html.split(/(<mark>|<\/mark>)/g);
  const nodes: React.ReactNode[] = [];
  let marking = false;
  parts.forEach((part, i) => {
    if (part === "<mark>") {
      marking = true;
      return;
    }
    if (part === "</mark>") {
      marking = false;
      return;
    }
    if (!part) return;
    nodes.push(
      marking ? (
        <mark key={i} className="rounded-sm px-0.5" style={{ background: "var(--mk-gold-soft)" }}>
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  });
  return <>{nodes}</>;
}
