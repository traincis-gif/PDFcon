import { OperationHandler } from "./index";
import { compressPdf } from "../../services/pdf-compress";
import { pdfToPng } from "../../services/pdf-to-png";
import { pdfToJpg } from "../../services/pdf-to-jpg";
import { imagesToPdf } from "../../services/img-to-pdf";

function requireFileKey(metadata: Record<string, any>, label: string): string {
  if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
    throw new Error(`Input file key required for ${label}`);
  }
  return metadata.fileKeys[0];
}

export const imageHandlers: Record<string, OperationHandler> = {
  PDF_TO_PNG: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "PDF to PNG");
    const result = await pdfToPng({
      inputKey,
      outputKeyPrefix: metadata._outputBase,
      dpi: metadata.dpi || 150,
      pages: metadata.pages,
    });
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKeys[0],
      metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
    });
    return { outputKey: result.outputKeys[0], contentType: "image/png" };
  },

  PDF_TO_JPG: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "PDF to JPG");
    const result = await pdfToJpg({
      inputKey,
      outputKeyPrefix: metadata._outputBase,
      dpi: metadata.dpi || 150,
      pages: metadata.pages,
    });
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKeys[0],
      metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
    });
    return { outputKey: result.outputKeys[0], contentType: "image/jpeg" };
  },

  IMG_TO_PDF: async (jobId, metadata, ctx) => {
    if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
      throw new Error("At least one image file key required for IMG to PDF");
    }
    const imageBuffers = await Promise.all(
      metadata.fileKeys.map(async (key: string) => {
        const buffer = await ctx.getFile(key);
        const ext = key.split(".").pop()?.toLowerCase() || "";
        const mimetype = ext === "png" ? "image/png" : "image/jpeg";
        return { buffer, mimetype };
      })
    );
    const pdfBuffer = await imagesToPdf(imageBuffers);
    const outputKey = `${metadata._outputBase}/images.pdf`;
    await ctx.putFile(outputKey, pdfBuffer, "application/pdf");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, size: pdfBuffer.length, imageCount: imageBuffers.length },
    });
    return { outputKey, contentType: "application/pdf" };
  },

  COMPRESS: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "compress");
    const result = await compressPdf({
      inputKey,
      outputKey: `${metadata._outputBase}/compressed.pdf`,
      quality: metadata.quality || "medium",
    });
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: {
        ...metadata,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        ratio: result.ratio,
      },
    });
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },
};
