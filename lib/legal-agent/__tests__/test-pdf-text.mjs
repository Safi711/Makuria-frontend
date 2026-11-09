// Tests for PDF text-layer extraction. Run: node lib/legal-agent/__tests__/test-pdf-text.mjs
import assert from "node:assert/strict";
import { extractPdfText, extractPdfDocument } from "../pdf-text.mjs";
import { assessDocument, STATUS } from "../intake.mjs";

// Builds a minimal PDF with one page per entry. A null entry is a page with no text layer (like a scan).
function buildPdf(pageTexts) {
  const n = pageTexts.length;
  const pageObjIds = pageTexts.map((_, i) => 3 + i * 2);
  const fontId = 3 + n * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${n} >>`,
  ];
  pageTexts.forEach((text, i) => {
    const contentId = pageObjIds[i] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    );
    const content =
      text === null ? "" : typeof text === "object" ? text.raw : `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

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

const LONG = "Decision number 143 with enough text to count as a readable document for the intake check.";

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

await test("extracts text from a PDF with a text layer", async () => {
  const text = await extractPdfText(buildPdf(["Decision number 143"]));
  assert.match(text, /Decision number 143/);
});

await test("single-page scan is classified image and unreadable", async () => {
  const doc = await extractPdfDocument(buildPdf([null]));
  assert.equal(doc.pdfKind, "image");
  assert.equal(doc.text, "");
  const e = assessDocument({ id: "scan", name: "scan.pdf", kind: "pdf", text: doc.text, pdfKind: doc.pdfKind });
  assert.equal(e.status, STATUS.UNREADABLE);
});

await test("mixed file: text pages and scanned pages are reported per page", async () => {
  const doc = await extractPdfDocument(buildPdf([LONG, null, LONG]));
  assert.equal(doc.pdfKind, "mixed");
  assert.equal(doc.pageCount, 3);
  assert.equal(doc.pagesWithText, 2);
  assert.equal(doc.pagesWithoutText, 1);
  assert.deepEqual(doc.pages, [
    { index: 1, hasText: true },
    { index: 2, hasText: false },
    { index: 3, hasText: true },
  ]);
  const e = assessDocument({ id: "mix", name: "mix.pdf", kind: "pdf", text: doc.text, pdfKind: doc.pdfKind });
  assert.equal(e.status, STATUS.INCOMPLETE);
  assert.match(e.reason, /صفحات بلا طبقة نص/);
});

await test("all-text file is classified text and readable", async () => {
  const doc = await extractPdfDocument(buildPdf([LONG, LONG]));
  assert.equal(doc.pdfKind, "text");
  const e = assessDocument({ id: "ok", name: "ok.pdf", kind: "pdf", text: doc.text, pdfKind: doc.pdfKind });
  assert.equal(e.status, STATUS.READABLE);
});

await test("lines are read top to bottom even when the PDF stores the lower line first", async () => {
  // Lower line (y=60) is written first in the content stream, upper line (y=150) second.
  const raw = "BT /F1 12 Tf 20 60 Td (LOWER line) Tj ET BT /F1 12 Tf 20 150 Td (UPPER line) Tj ET";
  const text = await extractPdfText(buildPdf([{ raw }]));
  assert.ok(text.indexOf("UPPER") < text.indexOf("LOWER"), `got: ${text}`);
});

await test("left-to-right text keeps its word order", async () => {
  const text = await extractPdfText(buildPdf(["Hello big world"]));
  assert.match(text, /Hello big world/);
});

await test("non-PDF bytes are rejected, not silently accepted", async () => {
  await assert.rejects(extractPdfText(new TextEncoder().encode("not a pdf at all")));
});

console.log(`\n${passed} tests passed`);
