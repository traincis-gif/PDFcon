import { PDFDocument } from "pdf-lib";

export interface EncryptOptions {
  password: string;
}

/**
 * Placeholder for PDF encryption.
 *
 * pdf-lib does not support native PDF encryption (password protection).
 * This function loads the PDF, stores the intended password in the document
 * metadata as a marker, and returns the saved PDF.
 *
 * TODO: Replace with a real encryption implementation using a library that
 * supports PDF encryption (e.g., qpdf via child_process, or muhammara).
 */
export async function encryptPdf(
  pdfBuffer: Buffer,
  options: EncryptOptions
): Promise<Buffer> {
  const { password } = options;

  if (!password || password.length === 0) {
    throw new Error("A non-empty password is required");
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

  // Mark that encryption was requested via metadata.
  // This does NOT actually encrypt the file -- it is a placeholder.
  pdfDoc.setSubject(`encrypted:true`);
  pdfDoc.setProducer("PDFlow (encryption pending)");

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
