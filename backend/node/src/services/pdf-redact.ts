import { PDFDocument, rgb } from "pdf-lib";

export interface RedactRegion {
  /** 1-indexed page number */
  page: number;
  /** X coordinate of the bottom-left corner of the rectangle */
  x: number;
  /** Y coordinate of the bottom-left corner of the rectangle */
  y: number;
  width: number;
  height: number;
}

export interface RedactOptions {
  regions: RedactRegion[];
}

/**
 * Redact (black out) specified rectangular areas on specified pages of a PDF.
 *
 * Coordinates use the PDF coordinate system where (0, 0) is the bottom-left
 * corner of the page.
 */
export async function redactPdf(
  pdfBuffer: Buffer,
  options: RedactOptions
): Promise<Buffer> {
  const { regions } = options;

  if (!regions || regions.length === 0) {
    throw new Error("At least one redaction region is required");
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (const region of regions) {
    const pageIndex = region.page - 1;

    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(
        `Page ${region.page} is out of range (document has ${pages.length} pages)`
      );
    }

    const page = pages[pageIndex];

    page.drawRectangle({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      color: rgb(0, 0, 0),
      opacity: 1,
    });
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
