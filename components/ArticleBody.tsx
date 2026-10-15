/**
 * The text of one article or schedule, as stored in `content_ar`.
 *
 * Line breaks are part of the text: each «(أ)», «(1)» or «(أولاً)» clause
 * starts on its own line. A plain <p> collapsed them into one run-on
 * paragraph, so every line is now its own block.
 *
 * Schedules carry tables. Their rows are stored one per line with the cells
 * separated by « | »; consecutive such lines are drawn as a table so the
 * columns stay aligned instead of reading as a string of numbers.
 */

const CELL_SEP = " | ";

type Block = { kind: "line"; text: string } | { kind: "table"; rows: string[][] };

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (raw.includes(CELL_SEP)) {
      const cells = raw.split(CELL_SEP).map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "table") last.rows.push(cells);
      else blocks.push({ kind: "table", rows: [cells] });
    } else {
      blocks.push({ kind: "line", text: line });
    }
  }
  return blocks;
}

export function ArticleBody({ content }: { content: string | null }) {
  if (!content) return null;
  const blocks = toBlocks(content);
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.kind === "line" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <div key={i} className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className="border px-2 py-1 align-top"
                        style={{ borderColor: "var(--mk-border)" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
