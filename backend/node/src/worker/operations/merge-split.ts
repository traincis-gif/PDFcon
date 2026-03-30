import { OperationHandler } from "./index";
import { mergePdfs } from "../../services/pdf-merge";
import { splitPdf } from "../../services/pdf-split";

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
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKeys[0],
      metadata: { ...metadata, outputKeys: result.outputKeys, partCount: result.partCount },
    });
    return { outputKey: result.outputKeys[0], contentType: "application/pdf" };
  },
};
