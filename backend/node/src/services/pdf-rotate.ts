import { PDFDocument, degrees } from "pdf-lib";

export interface RotateOptions {
  pages?: number[];
  angle: 90 | 180 | 270;
}

/**
 * Rotate specified pages (or all pages) of a PDF by a given angle.
 * Pages in the options are 1-indexed.
 */
export async function rotatePdf(
  pdfBuffer: Buffer,
  options: RotateOptions
): Promise<Buffer> {
  const { pages, angle } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const allPages = pdfDoc.getPages();

  const targetIndices: Set<number> = pages
    ? new Set(pages.map((p) => p - 1))
    : new Set(allPages.map((_, i) => i));

  for (const idx of targetIndices) {
    if (idx < 0 || idx >= allPages.length) {
      throw new Error(
        `Page ${idx + 1} is out of range (document has ${allPages.length} pages)`
      );
    }
    const page = allPages[idx];
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + angle) % 360));
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
