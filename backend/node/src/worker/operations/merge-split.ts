import { OperationHandler } from "./index";
import { mergePdfs } from "../../services/pdf-merge";
import { splitPdf } from "../../services/pdf-split";
import { createZipArchive } from "../../services/zip-archive";
import { getObjectBuffer, putObject } from "../../storage/r2";

export const mergeSplitHandlers: Record<string, OperationHandler> = {
  MERGE: async (jobId, metadata, ctx) => {
    if (!metadata.fileKeys || metadata.fileKeys.length < 2) {
      throw new Error("At least 2 file keys required for merge");
    }
    const result = await mergePdfs({
      fileKeys: metadata.fileKeys,
      outputKey: `${metadata._outputBase}/merged.pdf`,
    });
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: { ...metadata, pageCount: result.pageCount },
    });
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },

  SPLIT: async (jobId, metadata, ctx) => {
    if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
      throw new Error("Input file key required for split");
    }
    const inputKey = metadata.fileKeys[0];
    const result = await splitPdf({
      inputKey,
      outputKeyPrefix: metadata._outputBase,
      pages: metadata.pages || "all",
    });

    // If only one part, return it directly without zipping
    if (result.outputKeys.length === 1) {
      await ctx.updateStatus(jobId, "DONE", {
        outputUrl: result.outputKeys[0],
        metadata: { ...metadata, outputKeys: result.outputKeys, partCount: result.partCount },
      });
      return { outputKey: result.outputKeys[0], contentType: "application/pdf" };
    }

    // Multiple parts: collect all split PDFs and create a ZIP archive
    const zipEntries = await Promise.all(
      result.outputKeys.map(async (key, i) => {
        const buffer = await getObjectBuffer(key);
        return { name: `part-${i + 1}.pdf`, buffer };
      })
    );

    const zipBuffer = await createZipArchive(zipEntries);
    const zipKey = `${metadata._outputBase}/split-pages.zip`;
    await putObject(zipKey, zipBuffer, "application/zip");

    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: zipKey,
      metadata: { ...metadata, outputKeys: result.outputKeys, partCount: result.partCount },
    });
    return { outputKey: zipKey, contentType: "application/zip" };
  },
};
