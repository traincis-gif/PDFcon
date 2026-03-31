import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);

export interface PdfToJpgOptions {
  inputKey: string;
  outputKeyPrefix: string;
  dpi: number;
  quality?: number;
  pages?: string;
}

function parsePageNumbers(spec: string | undefined, totalPages: number): number[] {
  if (!spec) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages: number[] = [];
  const parts = spec.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10) - 1;
      const end = parseInt(endStr, 10) - 1;
      for (let i = start; i <= end && i < totalPages; i++) {
        if (i >= 0) pages.push(i);
      }
    } else {
      const page = parseInt(part, 10) - 1;
      if (page >= 0 && page < totalPages) pages.push(page);
    }
  }
  return [...new Set(pages)].sort((a, b) => a - b);
}

export async function pdfToJpg(
  options: PdfToJpgOptions
): Promise<{ outputKeys: string[]; pageCount: number }> {
  const { inputKey, outputKeyPrefix, dpi = 150, quality = 85 } = options;

  logger.info({ inputKey, dpi, quality }, "Starting PDF to JPG conversion");

  const pdfBytes = await getObjectBuffer(inputKey);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pageIndices = parsePageNumbers(options.pages, totalPages);

  const workDir = await mkdtemp(path.join(tmpdir(), "pdf2jpg-"));
  const inputPath = path.join(workDir, "input.pdf");
  await writeFile(inputPath, pdfBytes);

  const outputKeys: string[] = [];

  try {
    for (const pageIndex of pageIndices) {
      const pageNum = pageIndex + 1;
      const outputPrefix = path.join(workDir, `page`);

      // Use pdftoppm to convert PDF page to PPM, then sharp to convert to JPEG
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", String(dpi),
        "-f", String(pageNum),
        "-l", String(pageNum),
        "-singlefile",
        inputPath,
        outputPrefix,
      ], { timeout: 30000 });

      const pngPath = `${outputPrefix}.png`;
      const pngBuffer = await readFile(pngPath);

      // Convert PNG to JPEG with sharp (white background, quality setting)
      const jpgBuffer = await sharp(pngBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const outputKey = `${outputKeyPrefix}/page-${pageNum}.jpg`;
      await putObject(outputKey, jpgBuffer, "image/jpeg");
      outputKeys.push(outputKey);

      logger.debug({ outputKey, pageNum }, "Converted PDF page to JPG");
    }

    logger.info({ pageCount: outputKeys.length, totalPages }, "PDF to JPG conversion complete");
    return { outputKeys, pageCount: outputKeys.length };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
