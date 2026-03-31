import { OperationHandler } from "./index";
import { compressPdf } from "../../services/pdf-compress";
import { pdfToPng } from "../../services/pdf-to-png";
import { pdfToJpg } from "../../services/pdf-to-jpg";
import { imagesToPdf } from "../../services/img-to-pdf";
import { createZipArchive } from "../../services/zip-archive";
import { getObjectBuffer, putObject } from "../../storage/r2";

function requireFileKey(metadata: Record<string, any>, label: string): string {
  if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
    throw new Error(`Input file key required for ${label}`);
  }
  return metadata.fileKeys[0];
}

export const imageHandlers: Record<string, OperationHandler> = {
  PDF_TO_PNG: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "PDF to PNG");
    ctx.reportProgress(5);
    const result = await pdfToPng({
      inputKey,
      outputKeyPrefix: metadata._outputBase,
      dpi: metadata.dpi || 150,
      pages: metadata.pages,
    });
    ctx.reportProgress(50);

    // Single page: return the image directly
    if (result.outputKeys.length === 1) {
      await ctx.updateStatus(jobId, "DONE", {
        outputUrl: result.outputKeys[0],
        metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
      });
      ctx.reportProgress(100);
      return { outputKey: result.outputKeys[0], contentType: "image/png" };
    }

    // Multiple pages: ZIP all PNGs together
    const total = result.outputKeys.length;
    const zipEntries = [];
    for (let i = 0; i < total; i++) {
      const buffer = await getObjectBuffer(result.outputKeys[i]);
      zipEntries.push({ name: `page-${i + 1}.png`, buffer });
      ctx.reportProgress(50 + Math.round(((i + 1) / total) * 40));
    }

    const zipBuffer = await createZipArchive(zipEntries);
    const zipKey = `${metadata._outputBase}/pages.zip`;
    await putObject(zipKey, zipBuffer, "application/zip");

    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: zipKey,
      metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
    });
    ctx.reportProgress(100);
    return { outputKey: zipKey, contentType: "application/zip" };
  },

  PDF_TO_JPG: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "PDF to JPG");
    ctx.reportProgress(5);
    const result = await pdfToJpg({
      inputKey,
      outputKeyPrefix: metadata._outputBase,
      dpi: metadata.dpi || 150,
      pages: metadata.pages,
    });
    ctx.reportProgress(50);

    // Single page: return the image directly
    if (result.outputKeys.length === 1) {
      await ctx.updateStatus(jobId, "DONE", {
        outputUrl: result.outputKeys[0],
        metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
      });
      ctx.reportProgress(100);
      return { outputKey: result.outputKeys[0], contentType: "image/jpeg" };
    }

    // Multiple pages: ZIP all JPGs together
    const total = result.outputKeys.length;
    const zipEntries = [];
    for (let i = 0; i < total; i++) {
      const buffer = await getObjectBuffer(result.outputKeys[i]);
      zipEntries.push({ name: `page-${i + 1}.jpg`, buffer });
      ctx.reportProgress(50 + Math.round(((i + 1) / total) * 40));
    }

    const zipBuffer = await createZipArchive(zipEntries);
    const zipKey = `${metadata._outputBase}/pages.zip`;
    await putObject(zipKey, zipBuffer, "application/zip");

    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: zipKey,
      metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
    });
    ctx.reportProgress(100);
    return { outputKey: zipKey, contentType: "application/zip" };
  },

  IMG_TO_PDF: async (jobId, metadata, ctx) => {
    if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
      throw new Error("At least one image file key required for IMG to PDF");
    }
    const total = metadata.fileKeys.length;
    const imageBuffers = [];
    for (let i = 0; i < total; i++) {
      const key = metadata.fileKeys[i];
      const buffer = await ctx.getFile(key);
      const ext = key.split(".").pop()?.toLowerCase() || "";
      const mimetype = ext === "png" ? "image/png" : "image/jpeg";
      imageBuffers.push({ buffer, mimetype });
      ctx.reportProgress(Math.round(((i + 1) / total) * 50));
    }
    const pdfBuffer = await imagesToPdf(imageBuffers);
    ctx.reportProgress(80);
    const outputKey = `${metadata._outputBase}/images.pdf`;
    await ctx.putFile(outputKey, pdfBuffer, "application/pdf");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, size: pdfBuffer.length, imageCount: imageBuffers.length },
    });
    ctx.reportProgress(100);
    return { outputKey, contentType: "application/pdf" };
  },

  COMPRESS: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "compress");
    ctx.reportProgress(10);
    const result = await compressPdf({
      inputKey,
      outputKey: `${metadata._outputBase}/compressed.pdf`,
      quality: metadata.quality || "medium",
    });
    ctx.reportProgress(90);
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: {
        ...metadata,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        ratio: result.ratio,
      },
    });
    ctx.reportProgress(100);
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },
};
