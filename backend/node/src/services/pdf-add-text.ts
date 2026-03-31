import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";

export interface AddTextOptions {
  inputKey: string;
  outputKey: string;
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize?: number;
  color?: string | { r: number; g: number; b: number };
}

/**
 * Parse a color value that may be a hex string (e.g. "#DC2626") or an
 * { r, g, b } object (0-1 range) into an { r, g, b } object in 0-1 range.
 */
function parseColor(
  color: string | { r: number; g: number; b: number } | undefined
): { r: number; g: number; b: number } {
  if (!color) {
    return { r: 0, g: 0, b: 0 };
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

export async function addTextToPdf(
  options: AddTextOptions
): Promise<{ outputKey: string; pageCount: number }> {
  const {
    inputKey,
    outputKey,
    text,
    page,
    x,
    y,
    fontSize = 12,
    color: rawColor,
  } = options;

  const color = parseColor(rawColor);

  logger.info({ inputKey, page, text: text.substring(0, 50) }, "Starting PDF add text");

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const pageCount = pdfDoc.getPageCount();
  if (page < 0 || page >= pageCount) {
    throw new Error(
      `Page index ${page} is out of range. PDF has ${pageCount} page(s) (0-indexed).`
    );
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pdfPage = pdfDoc.getPage(page);

  pdfPage.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(
      Math.min(1, Math.max(0, color.r)),
      Math.min(1, Math.max(0, color.g)),
      Math.min(1, Math.max(0, color.b))
    ),
  });

  const modifiedBytes = await pdfDoc.save();
  const buffer = Buffer.from(modifiedBytes);
  await putObject(outputKey, buffer, "application/pdf");

  logger.info({ outputKey, pageCount, sizeBytes: buffer.length }, "PDF add text complete");

  return { outputKey, pageCount };
}
