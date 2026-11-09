// Text-layer extraction for PDFs (phase 1, spec A2).
// A page with no text layer (a scan) yields "". Mixed files are reported per page.
// No OCR in v1.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { createRequire } from "node:module";

// Standard font metrics ship with the package; pdf.js needs them for non-embedded fonts.
const require = createRequire(import.meta.url);
const STANDARD_FONT_DIR = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts");

// Returns one entry per page: { index, text }.
export async function extractPdfPages(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONT_DIR + path.sep,
  });
  try {
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
      pages.push({ index: i, text: line.replace(/\s+/g, " ").trim() });
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

// Classifies the file as a whole: "text" (all pages have a text layer),
// "image" (no page does: a scan), or "mixed" (some pages only).
export function classifyPages(pages) {
  const withText = pages.filter((p) => p.text.length > 0).length;
  let pdfKind;
  if (pages.length === 0 || withText === 0) pdfKind = "image";
  else if (withText === pages.length) pdfKind = "text";
  else pdfKind = "mixed";
  return {
    pdfKind,
    pageCount: pages.length,
    pagesWithText: withText,
    pagesWithoutText: pages.length - withText,
  };
}

// Full document read used by intake: text of all pages plus per-page classification.
export async function extractPdfDocument(bytes) {
  const pages = await extractPdfPages(bytes);
  return {
    ...classifyPages(pages),
    text: pages.filter((p) => p.text).map((p) => p.text).join("\n"),
    pages: pages.map((p) => ({ index: p.index, hasText: p.text.length > 0 })),
  };
}

// Kept for callers that only need the text.
export async function extractPdfText(bytes) {
  return (await extractPdfDocument(bytes)).text;
}
