// Text-layer extraction for PDFs (phase 1, spec A2).
// Returns the text the PDF carries. A scanned PDF has no text layer and yields "",
// which intake.mjs then classifies as unreadable. No OCR in v1.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

// Standard font metrics ship with the package; pdf.js needs them for non-embedded fonts.
const require = createRequire(import.meta.url);
const STANDARD_FONT_DIR = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts");

export async function extractPdfText(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: pathToFileURL(STANDARD_FONT_DIR + path.sep).href,
  });
  try {
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
      pages.push(line.replace(/\s+/g, " ").trim());
    }
    return pages.filter(Boolean).join("\n");
  } finally {
    await loadingTask.destroy();
  }
}
