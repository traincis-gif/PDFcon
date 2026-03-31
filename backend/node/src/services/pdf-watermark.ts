import { PDFDocument, rgb, degrees } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";
import { embedFont } from "./font-helper";

export interface WatermarkOptions {
  inputKey: string;
  outputKey: string;
  text: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  color?: string | { r: number; g: number; b: number };
}

/**
 * Parse a color value that may be a hex string (e.g. "#9CA3AF") or an
 * { r, g, b } object (0-1 range) into an { r, g, b } object in 0-1 range.
 */
function parseColor(
  color: string | { r: number; g: number; b: number } | undefined
): { r: number; g: number; b: number } {
  if (!color) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }

  if (typeof color === "string") {
    const hex = color.replace(/^#/, "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b };
  }

  return color;
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
    color: rawColor,
  } = options;

  const color = parseColor(rawColor);

  logger.info({ inputKey, text: text.substring(0, 50) }, "Starting PDF watermark");

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await embedFont(pdfDoc);

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
