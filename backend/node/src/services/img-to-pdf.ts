import { PDFDocument } from "pdf-lib";

export interface ImageInput {
  buffer: Buffer;
  mimetype: string;
}

/**
 * Convert one or more images (PNG or JPG) into a single PDF.
 *
 * Each image becomes a full page whose dimensions match the image's
 * natural pixel size (1 pixel = 1 PDF point).
 */
export async function imagesToPdf(imageBuffers: ImageInput[]): Promise<Buffer> {
  if (!imageBuffers || imageBuffers.length === 0) {
    throw new Error("At least one image is required");
  }

  const pdfDoc = await PDFDocument.create();

  for (const { buffer, mimetype } of imageBuffers) {
    const isPng =
      mimetype === "image/png" ||
      (buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47);

    const image = isPng
      ? await pdfDoc.embedPng(buffer)
      : await pdfDoc.embedJpg(buffer);

    const dims = image.scale(1);

    const page = pdfDoc.addPage([dims.width, dims.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: dims.width,
      height: dims.height,
    });
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
