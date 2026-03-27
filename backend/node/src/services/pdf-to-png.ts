import sharp from "sharp";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";

// We use pdf-lib to extract page count and sharp for rendering
// For actual rendering, we convert PDF pages to images using a canvas approach
import { PDFDocument } from "pdf-lib";

export interface PdfToPngOptions {
  inputKey: string;
  outputKeyPrefix: string;
  dpi: number;
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

export async function pdfToPng(
  options: PdfToPngOptions
): Promise<{ outputKeys: string[]; pageCount: number }> {
  const { inputKey, outputKeyPrefix, dpi, pages } = options;

  logger.info({ inputKey, dpi }, "Starting PDF to PNG conversion");

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

    // Use sharp to create a PNG from the PDF page
    // sharp can handle PDF input with density setting
    const pngBuffer = await sharp(Buffer.from(singlePageBytes), {
      density: dpi,
    })
      .resize(outputWidth, outputHeight, { fit: "fill" })
      .png({ quality: 90, compressionLevel: 6 })
      .toBuffer();

    const outputKey = `${outputKeyPrefix}/page-${pageIndex + 1}.png`;
    await putObject(outputKey, pngBuffer, "image/png");
    outputKeys.push(outputKey);

    logger.debug(
      { outputKey, pageIndex: pageIndex + 1, width: outputWidth, height: outputHeight },
      "Converted PDF page to PNG"
    );
  }

  logger.info(
    { pageCount: outputKeys.length, totalPages },
    "PDF to PNG conversion complete"
  );

  return { outputKeys, pageCount: outputKeys.length };
}
