import { PDFDocument, rgb } from "pdf-lib";
import { embedFont } from "./font-helper";

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PageNumberOptions {
  position?: PageNumberPosition;
  startFrom?: number;
  fontSize?: number;
  format?: string;
}

/**
 * Add page numbers to every page of a PDF.
 *
 * Format template supports:
 *   {n}     - current page number
 *   {total} - total number of pages
 *
 * Default format: "{n} / {total}"
 */
export async function addPageNumbers(
  pdfBuffer: Buffer,
  options: PageNumberOptions = {}
): Promise<Buffer> {
  const {
    position = "bottom-center",
    startFrom = 1,
    fontSize = 12,
    format = "{n} / {total}",
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const font = await embedFont(pdfDoc);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const margin = 40;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const pageNum = startFrom + i;

    const text = format
      .replace(/\{n\}/g, String(pageNum))
      .replace(/\{total\}/g, String(totalPages));

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x: number;
    let y: number;

    // Compute x based on horizontal alignment
    if (position.endsWith("left")) {
      x = margin;
    } else if (position.endsWith("right")) {
      x = width - margin - textWidth;
    } else {
      // center
      x = (width - textWidth) / 2;
    }

    // Compute y based on vertical alignment
    if (position.startsWith("top")) {
      y = height - margin - textHeight;
    } else {
      // bottom
      y = margin;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
