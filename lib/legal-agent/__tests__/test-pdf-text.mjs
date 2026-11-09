// Tests for PDF text-layer extraction. Run: node lib/legal-agent/__tests__/test-pdf-text.mjs
import assert from "node:assert/strict";
import { extractPdfText } from "../pdf-text.mjs";
import { assessDocument, STATUS } from "../intake.mjs";

// Builds a minimal one-page PDF. If `text` is null the page has no text layer (like a scan).
function buildPdf(text) {
  const content = text === null ? "" : `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

await test("extracts text from a PDF with a text layer", async () => {
  const text = await extractPdfText(buildPdf("Decision number 143"));
  assert.match(text, /Decision number 143/);
});

await test("PDF without a text layer yields empty text and is unreadable", async () => {
  const text = await extractPdfText(buildPdf(null));
  assert.equal(text, "");
  const e = assessDocument({ id: "scan", name: "scan.pdf", kind: "pdf", text });
  assert.equal(e.status, STATUS.UNREADABLE);
});

await test("non-PDF bytes are rejected, not silently accepted", async () => {
  await assert.rejects(extractPdfText(new TextEncoder().encode("not a pdf at all")));
});

console.log(`\n${passed} tests passed`);
