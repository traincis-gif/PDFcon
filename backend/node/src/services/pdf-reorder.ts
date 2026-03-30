import { PDFDocument } from "pdf-lib";

export interface ReorderOptions {
  /** 1-indexed array specifying the new page order, e.g. [3, 1, 2] */
  pageOrder: number[];
}

/**
 * Reorder (rearrange) pages in a PDF.
 *
 * Creates a brand new PDF and copies pages from the source document
 * in the order specified by pageOrder (1-indexed).
 */
export async function reorderPages(
  pdfBuffer: Buffer,
  options: ReorderOptions
): Promise<Buffer> {
  const { pageOrder } = options;

  if (!pageOrder || pageOrder.length === 0) {
    throw new Error("pageOrder must be a non-empty array");
  }

  const sourceDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pageCount = sourceDoc.getPageCount();

  // Validate every entry in pageOrder
  for (const p of pageOrder) {
    if (p < 1 || p > pageCount) {
      throw new Error(
        `Page ${p} is out of range (document has ${pageCount} pages)`
      );
    }
  }

  const newDoc = await PDFDocument.create();

  // Convert 1-indexed to 0-indexed
  const zeroIndexed = pageOrder.map((p) => p - 1);
  const copiedPages = await newDoc.copyPages(sourceDoc, zeroIndexed);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const resultBytes = await newDoc.save();
  return Buffer.from(resultBytes);
}
