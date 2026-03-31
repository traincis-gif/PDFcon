import { PDFDocument } from "pdf-lib";
import { logger } from "../lib/logger";

/**
 * Flatten all form fields in a PDF, converting interactive fields
 * into static content that can no longer be edited.
 */
export async function flattenPdf(pdfBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

  try {
    const form = pdfDoc.getForm();
    form.flatten();
  } catch (error) {
    // If there are no form fields or the form cannot be retrieved,
    // just return the PDF as-is (re-saved through pdf-lib).
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Could not flatten PDF form fields (PDF may have no forms)"
    );
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
