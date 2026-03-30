import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";

export interface WatermarkOptions {
  inputKey: string;
  outputKey: string;
  text: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  color?: { r: number; g: number; b: number };
}

export async function addWatermark(
  options: WatermarkOptions
): Promise<{ outputKey: string; pageCount: number }> {
  const {
    inputKey,
    outputKey,
    text,
    fontSize = 60,
    opacity = 0.15,
    rotation = 45,
    color = { r: 0.5, g: 0.5, b: 0.5 },
  } = options;

  logger.info({ inputKey, text: text.substring(0, 50) }, "Starting PDF watermark");

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Center the text on the page
    const x = (width - textWidth) / 2;
    const y = (height - textHeight) / 2;

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(
        Math.min(1, Math.max(0, color.r)),
        Math.min(1, Math.max(0, color.g)),
        Math.min(1, Math.max(0, color.b))
      ),
      opacity: Math.min(1, Math.max(0, opacity)),
      rotate: degrees(rotation),
    });
  }

  const modifiedBytes = await pdfDoc.save();
  const buffer = Buffer.from(modifiedBytes);
  await putObject(outputKey, buffer, "application/pdf");

  const pageCount = pdfDoc.getPageCount();
  logger.info({ outputKey, pageCount, sizeBytes: buffer.length }, "PDF watermark complete");

  return { outputKey, pageCount };
}
