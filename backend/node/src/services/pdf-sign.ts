import { PDFDocument } from "pdf-lib";

export interface SignatureOptions {
  /** Base64-encoded PNG or JPG image data */
  signatureImageBase64: string;
  /** 1-indexed page number to place the signature on */
  page: number;
  /** X coordinate (bottom-left origin) */
  x: number;
  /** Y coordinate (bottom-left origin) */
  y: number;
  /** Display width of the signature image (defaults to image's natural width) */
  width?: number;
  /** Display height of the signature image (defaults to image's natural height) */
  height?: number;
}

/**
 * Add a signature image (PNG or JPG) to a specific page of a PDF.
 *
 * The image is embedded and drawn at the specified position and optional size.
 * Image format is auto-detected from the base64 data header bytes.
 */
export async function addSignature(
  pdfBuffer: Buffer,
  options: SignatureOptions
): Promise<Buffer> {
  const { signatureImageBase64, page, x, y, width, height } = options;

  if (!signatureImageBase64) {
    throw new Error("signatureImageBase64 is required");
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const pageIndex = page - 1;

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(
      `Page ${page} is out of range (document has ${pages.length} pages)`
    );
  }

  const imageBytes = Buffer.from(signatureImageBase64, "base64");

  // Detect image type from magic bytes
  const isPng =
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47;

  const image = isPng
    ? await pdfDoc.embedPng(imageBytes)
    : await pdfDoc.embedJpg(imageBytes);

  const dims = image.scale(1);
  const drawWidth = width ?? dims.width;
  const drawHeight = height ?? dims.height;

  const targetPage = pages[pageIndex];
  targetPage.drawImage(image, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
