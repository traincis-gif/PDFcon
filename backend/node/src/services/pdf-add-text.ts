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
  color?: { r: number; g: number; b: number };
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
    color = { r: 0, g: 0, b: 0 },
  } = options;

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
