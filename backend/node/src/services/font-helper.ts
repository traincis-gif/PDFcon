import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs/promises";
import { logger } from "../lib/logger";

/**
 * Registry of known font families and their variant file paths on the system.
 */
const FONT_REGISTRY: Record<string, Record<string, string>> = {
  'DejaVu Sans': {
    regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    italic: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
    bolditalic: '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
  },
  'Liberation Sans': {
    regular: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    italic: '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
    bolditalic: '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
  },
  'Liberation Serif': {
    regular: '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    bold: '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    italic: '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
    bolditalic: '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',
  },
  'Liberation Mono': {
    regular: '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    bold: '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
    italic: '/usr/share/fonts/truetype/liberation/LiberationMono-Italic.ttf',
    bolditalic: '/usr/share/fonts/truetype/liberation/LiberationMono-BoldItalic.ttf',
  },
};

/**
 * Map common frontend font names to the system font families available
 * in FONT_REGISTRY.
 */
const FONT_NAME_MAP: Record<string, string> = {
  'Arial': 'Liberation Sans',
  'Helvetica': 'DejaVu Sans',
  'Times New Roman': 'Liberation Serif',
  'Courier': 'Liberation Mono',
  'Georgia': 'Liberation Serif',
  'Verdana': 'DejaVu Sans',
};

/** Cache of font file bytes keyed by absolute file path. */
const fontBytesCache = new Map<string, Buffer>();

/**
 * Read font bytes from disk, using a per-path cache to avoid repeated I/O.
 */
async function loadFontBytes(fontPath: string): Promise<Buffer | null> {
  const cached = fontBytesCache.get(fontPath);
  if (cached) return cached;

  try {
    const bytes = await fs.readFile(fontPath);
    fontBytesCache.set(fontPath, bytes);
    logger.info({ fontPath }, "Loaded font file");
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Determine the variant key from bold/italic flags.
 */
function variantKey(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'regular';
}

/**
 * Resolve a requested font family name to a FONT_REGISTRY key.
 * Checks FONT_NAME_MAP first, then checks if the name itself is a registry key.
 * Falls back to 'DejaVu Sans'.
 */
function resolveFamily(fontFamily?: string): string {
  if (!fontFamily) return 'DejaVu Sans';

  // Direct alias lookup
  const mapped = FONT_NAME_MAP[fontFamily];
  if (mapped && FONT_REGISTRY[mapped]) return mapped;

  // Direct registry key
  if (FONT_REGISTRY[fontFamily]) return fontFamily;

  // Case-insensitive search through aliases
  const lower = fontFamily.toLowerCase();
  for (const [alias, family] of Object.entries(FONT_NAME_MAP)) {
    if (alias.toLowerCase() === lower) return family;
  }

  // Case-insensitive search through registry keys
  for (const key of Object.keys(FONT_REGISTRY)) {
    if (key.toLowerCase() === lower) return key;
  }

  return 'DejaVu Sans';
}

export interface EmbedFontOptions {
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Embed a font in a PDF document.
 *
 * Resolves the requested font family and variant (bold/italic) to a system
 * font file. Falls back through progressively simpler options:
 *   1. Exact family + variant
 *   2. Exact family, regular variant
 *   3. DejaVu Sans, requested variant
 *   4. DejaVu Sans, regular
 *   5. Built-in Helvetica (ASCII only)
 */
export async function embedFont(
  pdfDoc: PDFDocument,
  options?: EmbedFontOptions
): Promise<PDFFont> {
  const family = resolveFamily(options?.fontFamily);
  const variant = variantKey(options?.bold, options?.italic);

  const familyEntry = FONT_REGISTRY[family];
  const fallbackEntry = FONT_REGISTRY['DejaVu Sans'];

  // Build an ordered list of font paths to try
  const candidates: string[] = [];

  if (familyEntry?.[variant]) candidates.push(familyEntry[variant]);
  if (familyEntry?.regular) candidates.push(familyEntry.regular);
  if (fallbackEntry?.[variant]) candidates.push(fallbackEntry[variant]);
  if (fallbackEntry?.regular) candidates.push(fallbackEntry.regular);

  for (const fontPath of candidates) {
    const bytes = await loadFontBytes(fontPath);
    if (bytes) {
      pdfDoc.registerFontkit(fontkit);
      return pdfDoc.embedFont(bytes);
    }
  }

  logger.warn("No system font found, falling back to Helvetica (ASCII only)");
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}
