import { PDFDocument } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";

export interface SplitOptions {
  inputKey: string;
  outputKeyPrefix: string;
  pages: string; // e.g., "1-3,5,7-10" or "all" for individual pages
}

function parsePageRanges(spec: string, totalPages: number): number[][] {
  if (spec === "all") {
    return Array.from({ length: totalPages }, (_, i) => [i]);
  }

  const groups: number[][] = [];
  const parts = spec.split(",").map((s) => s.trim());

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10) - 1; // Convert to 0-based
      const end = parseInt(endStr, 10) - 1;

      if (isNaN(start) || isNaN(end) || start < 0 || end >= totalPages || start > end) {
        throw new Error(`Invalid page range: ${part}. Document has ${totalPages} pages.`);
      }

      const group: number[] = [];
      for (let i = start; i <= end; i++) {
        group.push(i);
      }
      groups.push(group);
    } else {
      const page = parseInt(part, 10) - 1;
      if (isNaN(page) || page < 0 || page >= totalPages) {
        throw new Error(`Invalid page number: ${part}. Document has ${totalPages} pages.`);
      }
      groups.push([page]);
    }
  }

  return groups;
}

export async function splitPdf(
  options: SplitOptions
): Promise<{ outputKeys: string[]; partCount: number }> {
  const { inputKey, outputKeyPrefix, pages } = options;

  logger.info({ inputKey, pages }, "Starting PDF split");

  const pdfBytes = await getObjectBuffer(inputKey);
  const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = sourceDoc.getPageCount();

  const pageGroups = parsePageRanges(pages, totalPages);
  const outputKeys: string[] = [];

  for (let i = 0; i < pageGroups.length; i++) {
    const group = pageGroups[i];
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, group);

    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    const newBytes = await newDoc.save();
    const buffer = Buffer.from(newBytes);
    const outputKey = `${outputKeyPrefix}/part-${i + 1}.pdf`;

    await putObject(outputKey, buffer, "application/pdf");
    outputKeys.push(outputKey);

    logger.debug({ outputKey, pages: group.length }, "Created split part");
  }

  logger.info({ partCount: outputKeys.length, totalPages }, "PDF split complete");

  return { outputKeys, partCount: outputKeys.length };
}
