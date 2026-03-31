import { OperationHandler } from "./index";
import { extractText } from "../../services/pdf-to-txt";
import { ocrExtractFromPdf } from "../../services/ocr";

function requireFileKey(metadata: Record<string, any>, label: string): string {
  if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
    throw new Error(`Input file key required for ${label}`);
  }
  return metadata.fileKeys[0];
}

export const extractHandlers: Record<string, OperationHandler> = {
  PDF_TO_TXT: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "PDF to TXT");
    ctx.reportProgress(10);
    const pdfBuffer = await ctx.getFile(inputKey);
    ctx.reportProgress(30);
    const text = await extractText(pdfBuffer);
    ctx.reportProgress(80);
    const outputKey = `${metadata._outputBase}/extracted.txt`;
    await ctx.putFile(outputKey, Buffer.from(text, "utf-8"), "text/plain");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, textLength: text.length },
    });
    ctx.reportProgress(100);
    return { outputKey, contentType: "text/plain" };
  },

  OCR: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "OCR");
    ctx.reportProgress(10);
    const pdfBuffer = await ctx.getFile(inputKey);
    ctx.reportProgress(20);
    const ocrResult = await ocrExtractFromPdf(pdfBuffer, {
      language: metadata.language,
      pages: metadata.pages,
    });
    ctx.reportProgress(85);
    const outputKey = `${metadata._outputBase}/ocr-result.txt`;
    await ctx.putFile(outputKey, Buffer.from(ocrResult.text, "utf-8"), "text/plain");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, textLength: ocrResult.text.length, pageCount: ocrResult.pageTexts.length },
    });
    ctx.reportProgress(100);
    return { outputKey, contentType: "text/plain" };
  },
};
