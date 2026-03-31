import { PDFDocument } from "pdf-lib";

export interface ImageInput {
  buffer: Buffer;
  mimetype: string;
}

/** A4 page dimensions in PDF points (72 points per inch) */
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/**
 * Convert one or more images (PNG or JPG) into a single PDF.
 *
 * Each image is placed on an A4 page. Images larger than A4 are scaled
 * down to fit while maintaining aspect ratio. Smaller images are centered
 * on the A4 page without scaling up.
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

    // Scale image to fit within A4 while maintaining aspect ratio
    let drawWidth = dims.width;
    let drawHeight = dims.height;

    if (drawWidth > A4_WIDTH || drawHeight > A4_HEIGHT) {
      const scaleX = A4_WIDTH / drawWidth;
      const scaleY = A4_HEIGHT / drawHeight;
      const scale = Math.min(scaleX, scaleY);
      drawWidth = drawWidth * scale;
      drawHeight = drawHeight * scale;
    }

    // Center the image on the A4 page
    const x = (A4_WIDTH - drawWidth) / 2;
    const y = (A4_HEIGHT - drawHeight) / 2;

    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawImage(image, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
