import { PDFDocument } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";

export interface MergeOptions {
  fileKeys: string[];
  outputKey: string;
}

export async function mergePdfs(options: MergeOptions): Promise<{ outputKey: string; pageCount: number }> {
  const { fileKeys, outputKey } = options;

  if (!fileKeys || fileKeys.length < 2) {
    throw new Error("At least 2 PDF files are required for merging");
  }

  logger.info({ fileCount: fileKeys.length }, "Starting PDF merge");

  const mergedDoc = await PDFDocument.create();

  for (const key of fileKeys) {
    const pdfBytes = await getObjectBuffer(key);
    const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = await mergedDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    for (const page of pages) {
      mergedDoc.addPage(page);
    }
    logger.debug({ key, pages: sourceDoc.getPageCount() }, "Merged source PDF");
  }

  const mergedBytes = await mergedDoc.save();
  const buffer = Buffer.from(mergedBytes);
  await putObject(outputKey, buffer, "application/pdf");

  const pageCount = mergedDoc.getPageCount();
  logger.info({ outputKey, pageCount, sizeBytes: buffer.length }, "PDF merge complete");

  return { outputKey, pageCount };
}
