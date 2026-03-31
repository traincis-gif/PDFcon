import { createWorker, OEM } from "tesseract.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { logger } from "../lib/logger";

const execFileAsync = promisify(execFile);

export interface OcrExtractOptions {
  language?: string;
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

    logger.info({ language, textLength: text.length }, "OCR extraction complete");
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from a PDF by converting each page to an image via pdftoppm, then running OCR.
 */
export async function ocrExtractFromPdf(
  pdfBuffer: Buffer,
  options?: OcrExtractOptions & { dpi?: number; pages?: string }
): Promise<{ text: string; pageTexts: string[] }> {
  const language = options?.language ?? "eng";
  const dpi = options?.dpi ?? 300;

  logger.info({ language, dpi, bufferSize: pdfBuffer.length }, "Starting OCR extraction from PDF");

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pageIndices = parsePageNumbers(options?.pages, totalPages);

  const workDir = await mkdtemp(path.join(tmpdir(), "ocr-"));
  const inputPath = path.join(workDir, "input.pdf");
  await writeFile(inputPath, pdfBuffer);

  const worker = await createWorker(language, OEM.DEFAULT);
  const pageTexts: string[] = [];

  try {
    for (const pageIndex of pageIndices) {
      const pageNum = pageIndex + 1;
      const outputPrefix = path.join(workDir, `ocr-page`);

      // Use pdftoppm to convert PDF page to PNG
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", String(dpi),
        "-f", String(pageNum),
        "-l", String(pageNum),
        "-singlefile",
        inputPath,
        outputPrefix,
      ], { timeout: 60000 });

      const pngPath = `${outputPrefix}.png`;
      const imageBuffer = await readFile(pngPath);

      const { data } = await worker.recognize(imageBuffer);
      const pageText = data.text.trim();
      pageTexts.push(pageText);

      logger.debug({ pageIndex: pageNum, textLength: pageText.length }, "OCR extracted text from PDF page");
    }
  } finally {
    await worker.terminate();
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  const text = pageTexts
    .map((t, i) => `--- Page ${pageIndices[i] + 1} ---\n${t}`)
    .join("\n\n");

  logger.info({ totalPages, processedPages: pageTexts.length, textLength: text.length }, "OCR extraction from PDF complete");
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
