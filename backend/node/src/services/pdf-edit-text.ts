import { PDFDocument, rgb } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";
import { embedFont } from "./font-helper";

export interface TextEditOperation {
  page: number;       // 0-indexed
  x: number;          // PDF coordinates
  y: number;
  width: number;      // original text box width
  height: number;     // original text box height
  originalText: string;
  newText: string;
  fontSize: number;
}

export interface EditTextOptions {
  inputKey: string;
  outputKey: string;
  edits: TextEditOperation[];
}

/**
 * Clamp a color component to [0, 1].
 */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Apply inline text edits to a PDF.
 *
 * For each edit:
 * 1. Draw a white filled rectangle over the original text area to erase it
 * 2. Draw the new text at the same position with matching font size
 */
export async function editPdfText(
  options: EditTextOptions
): Promise<{ outputKey: string; editCount: number }> {
  const { inputKey, outputKey, edits } = options;

  logger.info(
    { inputKey, editCount: edits.length },
    "Starting PDF edit text"
  );

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const pageCount = pdfDoc.getPageCount();

  // Embed a default font for drawing replacement text
  const font = await embedFont(pdfDoc, { fontFamily: "Helvetica" });

  for (const edit of edits) {
    const { page, x, y, width, height, newText, fontSize } = edit;

    if (page < 0 || page >= pageCount) {
      logger.warn(
        { page, pageCount },
        "Edit text: page index out of range, skipping"
      );
      continue;
    }

    const pdfPage = pdfDoc.getPage(page);

    // Step 1: Draw a white rectangle to cover the original text
    // The coordinates from the frontend are:
    //   x = leftmost x in PDF space
    //   y = baseline y in PDF space (from bottom)
    //   height = font height
    //   width = text width
    // We need to cover from slightly below baseline to top of text
    const coverX = x - 1;
    const coverY = y - height * 0.3; // extend below baseline for descenders
    const coverWidth = width + 2;
    const coverHeight = height * 1.4; // cover full text height including ascenders

    pdfPage.drawRectangle({
      x: coverX,
      y: coverY,
      width: coverWidth,
      height: coverHeight,
      color: rgb(1, 1, 1), // white
      borderWidth: 0,
    });

    // Step 2: Draw the new text at the original position
    // y is the baseline position
    const drawFontSize = fontSize > 0 ? fontSize : 12;

    pdfPage.drawText(newText, {
      x: x,
      y: y,
      size: drawFontSize,
      font: font,
      color: rgb(0, 0, 0), // black
    });
  }

  const modifiedBytes = await pdfDoc.save();
  const buffer = Buffer.from(modifiedBytes);
  await putObject(outputKey, buffer, "application/pdf");

  logger.info(
    { outputKey, editCount: edits.length, sizeBytes: buffer.length },
    "PDF edit text complete"
  );

  return { outputKey, editCount: edits.length };
}
