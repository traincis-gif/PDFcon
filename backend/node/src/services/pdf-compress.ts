import { PDFDocument } from "pdf-lib";
import { getObjectBuffer, putObject } from "../storage/r2";
import { logger } from "../lib/logger";

export interface CompressOptions {
  inputKey: string;
  outputKey: string;
  quality: "low" | "medium" | "high";
}

const QUALITY_MAP = {
  low: { removeMetadata: true, flattenForms: true },
  medium: { removeMetadata: true, flattenForms: false },
  high: { removeMetadata: false, flattenForms: false },
};

export async function compressPdf(
  options: CompressOptions
): Promise<{ outputKey: string; originalSize: number; compressedSize: number; ratio: number }> {
  const { inputKey, outputKey, quality } = options;

  logger.info({ inputKey, quality }, "Starting PDF compression");

  const pdfBytes = await getObjectBuffer(inputKey);
  const originalSize = pdfBytes.length;

  const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const settings = QUALITY_MAP[quality];

  // Create a new document by copying all pages (strips unused objects)
  const compressedDoc = await PDFDocument.create();
  const pages = await compressedDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  for (const page of pages) {
    compressedDoc.addPage(page);
  }

  // Remove metadata if configured
  if (settings.removeMetadata) {
    compressedDoc.setTitle("");
    compressedDoc.setAuthor("");
    compressedDoc.setSubject("");
    compressedDoc.setKeywords([]);
    compressedDoc.setProducer("PDFlow");
    compressedDoc.setCreator("PDFlow");
  }

  // Flatten forms for maximum compression (low quality)
  if (settings.flattenForms) {
    try {
      const form = compressedDoc.getForm();
      form.flatten();
    } catch {
      // No form fields to flatten, that's fine
    }
  }

  // Save with object stream compression for better deflate compression
  const compressedBytes = await compressedDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  const buffer = Buffer.from(compressedBytes);
  const compressedSize = buffer.length;
  const ratio = compressedSize / originalSize;

  // Only use compressed version if it's actually smaller
  if (compressedSize < originalSize) {
    await putObject(outputKey, buffer, "application/pdf");
  } else {
    // If compression didn't help, use the original
    await putObject(outputKey, pdfBytes, "application/pdf");
    logger.warn(
      { inputKey, originalSize, compressedSize },
      "Compression did not reduce file size, using original"
    );
  }

  const finalSize = Math.min(compressedSize, originalSize);

  logger.info(
    {
      outputKey,
      originalSize,
      compressedSize: finalSize,
      ratio: (finalSize / originalSize).toFixed(2),
    },
    "PDF compression complete"
  );

  return {
    outputKey,
    originalSize,
    compressedSize: finalSize,
    ratio: finalSize / originalSize,
  };
}
