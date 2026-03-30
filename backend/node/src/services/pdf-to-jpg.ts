import sharp from "sharp";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";
import { PDFDocument } from "pdf-lib";

export interface PdfToJpgOptions {
  inputKey: string;
  outputKeyPrefix: string;
  dpi: number;
  quality?: number; // JPEG quality 1-100, default 85
  pages?: string; // "1-3,5" or undefined for all pages
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

export async function pdfToJpg(
  options: PdfToJpgOptions
): Promise<{ outputKeys: string[]; pageCount: number }> {
  const { inputKey, outputKeyPrefix, dpi, quality = 85, pages } = options;

  logger.info({ inputKey, dpi, quality }, "Starting PDF to JPG conversion");

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pageIndices = parsePageNumbers(pages, totalPages);

  const outputKeys: string[] = [];
  const scaleFactor = dpi / 72; // PDF standard is 72 DPI

  for (const pageIndex of pageIndices) {
    const page = pdfDoc.getPage(pageIndex);
    const { width, height } = page.getSize();

    // Create a single-page PDF for this page
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
    singlePageDoc.addPage(copiedPage);
    const singlePageBytes = await singlePageDoc.save();

    // Calculate output dimensions based on DPI
    const outputWidth = Math.round(width * scaleFactor);
    const outputHeight = Math.round(height * scaleFactor);

    // Use sharp to create a JPEG from the PDF page
    // sharp can handle PDF input with density setting
    const jpgBuffer = await sharp(Buffer.from(singlePageBytes), {
      density: dpi,
    })
      .resize(outputWidth, outputHeight, { fit: "fill" })
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background for JPEG (no alpha)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const outputKey = `${outputKeyPrefix}/page-${pageIndex + 1}.jpg`;
    await putObject(outputKey, jpgBuffer, "image/jpeg");
    outputKeys.push(outputKey);

    logger.debug(
      { outputKey, pageIndex: pageIndex + 1, width: outputWidth, height: outputHeight },
      "Converted PDF page to JPG"
    );
  }

  logger.info(
    { pageCount: outputKeys.length, totalPages },
    "PDF to JPG conversion complete"
  );

  return { outputKeys, pageCount: outputKeys.length };
}
