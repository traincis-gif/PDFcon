import { PDFDocument } from "pdf-lib";

/**
 * Flatten all form fields in a PDF, converting interactive fields
 * into static content that can no longer be edited.
 */
export async function flattenPdf(pdfBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

  try {
    const form = pdfDoc.getForm();
    form.flatten();
  } catch {
    // If there are no form fields or the form cannot be retrieved,
    // just return the PDF as-is (re-saved through pdf-lib).
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
