import { createWorker, OEM } from "tesseract.js";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { logger } from "../lib/logger";

export interface OcrExtractOptions {
  language?: string; // Tesseract language code, default 'eng'
}

/**
 * Extract text from an image buffer using Tesseract OCR.
 */
export async function ocrExtract(
  imageBuffer: Buffer,
  options?: OcrExtractOptions
): Promise<string> {
  const language = options?.language ?? "eng";

  logger.info({ language, bufferSize: imageBuffer.length }, "Starting OCR extraction");

  const worker = await createWorker(language, OEM.DEFAULT);

  try {
    const { data } = await worker.recognize(imageBuffer);
    const text = data.text.trim();

    logger.info(
      { language, textLength: text.length },
      "OCR extraction complete"
    );

    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from a PDF by converting each page to an image first, then running OCR.
 * Returns the concatenated text from all pages, separated by page markers.
 */
export async function ocrExtractFromPdf(
  pdfBuffer: Buffer,
  options?: OcrExtractOptions & { dpi?: number; pages?: string }
): Promise<{ text: string; pageTexts: string[] }> {
  const language = options?.language ?? "eng";
  const dpi = options?.dpi ?? 300;

  logger.info(
    { language, dpi, bufferSize: pdfBuffer.length },
    "Starting OCR extraction from PDF"
  );

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pageIndices = parsePageNumbers(options?.pages, totalPages);
  const scaleFactor = dpi / 72;

  const worker = await createWorker(language, OEM.DEFAULT);
  const pageTexts: string[] = [];

  try {
    for (const pageIndex of pageIndices) {
      const page = pdfDoc.getPage(pageIndex);
      const { width, height } = page.getSize();

      // Create a single-page PDF
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
      singlePageDoc.addPage(copiedPage);
      const singlePageBytes = await singlePageDoc.save();

      // Convert to PNG image for OCR (PNG is lossless, better for OCR accuracy)
      const outputWidth = Math.round(width * scaleFactor);
      const outputHeight = Math.round(height * scaleFactor);

      const imageBuffer = await sharp(Buffer.from(singlePageBytes), {
        density: dpi,
      })
        .resize(outputWidth, outputHeight, { fit: "fill" })
        .png()
        .toBuffer();

      const { data } = await worker.recognize(imageBuffer);
      const pageText = data.text.trim();
      pageTexts.push(pageText);

      logger.debug(
        { pageIndex: pageIndex + 1, textLength: pageText.length },
        "OCR extracted text from PDF page"
      );
    }
  } finally {
    await worker.terminate();
  }

  const text = pageTexts
    .map((t, i) => `--- Page ${pageIndices[i] + 1} ---\n${t}`)
    .join("\n\n");

  logger.info(
    { totalPages, processedPages: pageTexts.length, textLength: text.length },
    "OCR extraction from PDF complete"
  );

  return { text, pageTexts };
}

function parsePageNumbers(spec: string | undefined, totalPages: number): number[] {
  if (!spec) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const pages: number[] = [];
  const parts = spec.split(",").map((s) => s.trim());

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10) - 1;
      const end = parseInt(endStr, 10) - 1;
      for (let i = start; i <= end && i < totalPages; i++) {
        if (i >= 0) pages.push(i);
      }
    } else {
      const page = parseInt(part, 10) - 1;
      if (page >= 0 && page < totalPages) pages.push(page);
    }
  }

  return [...new Set(pages)].sort((a, b) => a - b);
}
