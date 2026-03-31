import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";
import { embedFont } from "./font-helper";

export interface TextPlacement {
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string | { r: number; g: number; b: number };
  alignment?: 'left' | 'center' | 'right';
  lineHeight?: number;
  opacity?: number;
}

export interface AddTextOptions {
  inputKey: string;
  outputKey: string;
  // Support single placement (backward compat) or array
  text?: string;
  page?: number;
  x?: number;
  y?: number;
  fontSize?: number;
  color?: string | { r: number; g: number; b: number };
  // New: array of placements
  placements?: TextPlacement[];
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

/**
 * Clamp a color component to [0, 1].
 */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Resolve the list of placements from options. If an explicit `placements`
 * array is provided it takes precedence; otherwise we build a single-element
 * array from the legacy top-level fields for backward compatibility.
 */
function resolvePlacements(options: AddTextOptions): TextPlacement[] {
  if (options.placements && options.placements.length > 0) {
    return options.placements;
  }

  if (!options.text) {
    throw new Error("Either 'placements' array or 'text' field is required");
  }

  return [
    {
      text: options.text,
      page: options.page ?? 0,
      x: options.x ?? 0,
      y: options.y ?? 0,
      fontSize: options.fontSize,
      color: options.color,
    },
  ];
}

/**
 * Draw a single text placement on a PDF page, handling rich formatting
 * (bold, italic, underline, strikethrough, alignment, opacity, multi-line).
 */
async function drawPlacement(
  pdfDoc: PDFDocument,
  pdfPage: PDFPage,
  placement: TextPlacement
): Promise<void> {
  const {
    text,
    x,
    y,
    fontSize = 12,
    fontFamily,
    bold,
    italic,
    underline = false,
    strikethrough = false,
    color: rawColor,
    alignment = 'left',
    lineHeight = 1.2,
    opacity,
  } = placement;

  const color = parseColor(rawColor);
  const pdfColor = rgb(clamp01(color.r), clamp01(color.g), clamp01(color.b));

  // Embed the correct font variant for this placement
  const font = await embedFont(pdfDoc, { fontFamily, bold, italic });

  const lines = text.split('\n');
  const lineStep = lineHeight * fontSize;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const textWidth = font.widthOfTextAtSize(line, fontSize);

    // Calculate x position based on alignment
    let drawX = x;
    if (alignment === 'center') {
      drawX = x - textWidth / 2;
    } else if (alignment === 'right') {
      drawX = x - textWidth;
    }

    // Each successive line moves downward (PDF y-axis goes up, so subtract)
    const drawY = y - i * lineStep;

    // Draw the text
    const drawOptions: Parameters<PDFPage['drawText']>[1] = {
      x: drawX,
      y: drawY,
      size: fontSize,
      font,
      color: pdfColor,
    };
    if (opacity !== undefined) {
      drawOptions.opacity = clamp01(opacity);
    }
    pdfPage.drawText(line, drawOptions);

    // Decorations: underline and strikethrough
    if (underline) {
      // Draw a line just below the text baseline
      const underlineY = drawY - fontSize * 0.15;
      pdfPage.drawLine({
        start: { x: drawX, y: underlineY },
        end: { x: drawX + textWidth, y: underlineY },
        thickness: fontSize * 0.05,
        color: pdfColor,
        opacity: opacity !== undefined ? clamp01(opacity) : undefined,
      });
    }

    if (strikethrough) {
      // Draw a line through the vertical middle of the text
      const strikeY = drawY + fontSize * 0.3;
      pdfPage.drawLine({
        start: { x: drawX, y: strikeY },
        end: { x: drawX + textWidth, y: strikeY },
        thickness: fontSize * 0.05,
        color: pdfColor,
        opacity: opacity !== undefined ? clamp01(opacity) : undefined,
      });
    }
  }
}

export async function addTextToPdf(
  options: AddTextOptions
): Promise<{ outputKey: string; pageCount: number }> {
  const { inputKey, outputKey } = options;
  const placements = resolvePlacements(options);

  logger.info(
    { inputKey, placementCount: placements.length },
    "Starting PDF add text"
  );

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const pageCount = pdfDoc.getPageCount();

  for (const placement of placements) {
    const { page } = placement;

    if (page < 0 || page >= pageCount) {
      throw new Error(
        `Page index ${page} is out of range. PDF has ${pageCount} page(s) (0-indexed).`
      );
    }

    const pdfPage = pdfDoc.getPage(page);
    await drawPlacement(pdfDoc, pdfPage, placement);
  }

  const modifiedBytes = await pdfDoc.save();
  const buffer = Buffer.from(modifiedBytes);
  await putObject(outputKey, buffer, "application/pdf");

  logger.info(
    { outputKey, pageCount, placementCount: placements.length, sizeBytes: buffer.length },
    "PDF add text complete"
  );

  return { outputKey, pageCount };
}
