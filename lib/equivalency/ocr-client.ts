"use client";

// Browser-side Arabic OCR for scanned exam papers. Runs entirely in the
// editor's browser (tesseract.js + the Arabic model fetched from its CDN), so
// no scan is sent to a third-party OCR service. PDFs are rendered page by page
// with pdf.js first. Settings match the ones used for the bulk import:
// Arabic, single uniform block of text (psm 6), ~200 dpi.

type Progress = (msg: string) => void;

async function pdfToCanvases(file: File, onProgress: Progress): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress(`تجهيز صفحة ${i} من ${doc.numPages} في ${file.name}…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 200 / 72 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    out.push(canvas);
  }
  return out;
}

export async function ocrFiles(files: File[], onProgress: Progress): Promise<string> {
  onProgress("تحميل نموذج اللغة العربية… (أول مرة قد تستغرق دقيقة)");
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("ara");
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  const texts: string[] = [];
  try {
    let n = 0;
    for (const f of files) {
      const images: (File | HTMLCanvasElement)[] =
        f.type === "application/pdf" ? await pdfToCanvases(f, onProgress) : [f];
      for (const img of images) {
        n++;
        onProgress(`استخراج نص الصفحة ${n}…`);
        const { data } = await worker.recognize(img);
        texts.push(data.text.trim());
      }
    }
  } finally {
    await worker.terminate();
  }
  return texts.join("\n\n— صفحة —\n\n");
}
