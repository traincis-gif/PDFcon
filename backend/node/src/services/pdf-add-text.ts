import { PDFDocument, rgb } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";
import { embedFont } from "./font-helper";

export interface TextPlacement {
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize?: number;
  color?: string | { r: number; g: number; b: number };
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

  // Embed the font once and reuse for all placements
  const font = await embedFont(pdfDoc);

  for (const placement of placements) {
    const { text, page, x, y, fontSize = 12, color: rawColor } = placement;

    if (page < 0 || page >= pageCount) {
      throw new Error(
        `Page index ${page} is out of range. PDF has ${pageCount} page(s) (0-indexed).`
      );
    }

    const color = parseColor(rawColor);
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
