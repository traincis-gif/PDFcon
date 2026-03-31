import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs/promises";
import { logger } from "../lib/logger";

/**
 * Font paths to try, in order of preference.
 * These are commonly available on Debian/Ubuntu with LibreOffice installed.
 */
const UNICODE_FONT_PATHS = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
];

let cachedFontBytes: Buffer | null = null;
let fontSearchDone = false;

/**
 * Load a Unicode-capable font buffer from the system.
 * Returns null if no suitable font is found.
 */
async function loadSystemFont(): Promise<Buffer | null> {
  if (fontSearchDone) return cachedFontBytes;
  fontSearchDone = true;

  for (const fontPath of UNICODE_FONT_PATHS) {
    try {
      cachedFontBytes = await fs.readFile(fontPath);
      logger.info({ fontPath }, "Loaded Unicode font for PDF text operations");
      return cachedFontBytes;
    } catch {
      // Try next font
    }
  }

  logger.warn("No Unicode system font found, falling back to Helvetica (ASCII only)");
  return null;
}

/**
 * Embed a font in a PDF document.
 * Uses a Unicode-capable system font if available, falls back to Helvetica.
 */
export async function embedFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const fontBytes = await loadSystemFont();

  if (fontBytes) {
    pdfDoc.registerFontkit(fontkit);
    return pdfDoc.embedFont(fontBytes);
  }

  return pdfDoc.embedFont(StandardFonts.Helvetica);
}
