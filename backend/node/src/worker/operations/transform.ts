import { OperationHandler } from "./index";
import { rotatePdf } from "../../services/pdf-rotate";
import { reorderPages } from "../../services/pdf-reorder";
import { addPageNumbers } from "../../services/pdf-page-numbers";
import { encryptPdf } from "../../services/pdf-encrypt";
import { flattenPdf } from "../../services/pdf-flatten";
import { redactPdf } from "../../services/pdf-redact";
import { addSignature } from "../../services/pdf-sign";
import { addTextToPdf } from "../../services/pdf-add-text";
import { addWatermark } from "../../services/pdf-watermark";

function requireFileKey(metadata: Record<string, any>, label: string): string {
  if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
    throw new Error(`Input file key required for ${label}`);
  }
  return metadata.fileKeys[0];
}

/**
 * Helper that wraps the common get -> transform -> put pattern for
 * single-file PDF buffer transformations.
 */
function bufferTransformHandler(
  label: string,
  outputFilename: string,
  transformFn: (buffer: Buffer, metadata: Record<string, any>) => Promise<Buffer>
): OperationHandler {
  return async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, label);
    const pdfBuffer = await ctx.getFile(inputKey);
    const resultBuffer = await transformFn(pdfBuffer, metadata);
    const outputKey = `${metadata._outputBase}/${outputFilename}`;
    await ctx.putFile(outputKey, resultBuffer, "application/pdf");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, size: resultBuffer.length },
    });
    return { outputKey, contentType: "application/pdf" };
  };
}

export const transformHandlers: Record<string, OperationHandler> = {
  ROTATE: bufferTransformHandler("rotate", "rotated.pdf", async (buffer, metadata) => {
    if (!metadata.angle) {
      throw new Error("Angle is required for rotate (90, 180, or 270)");
    }
    return rotatePdf(buffer, {
      angle: metadata.angle,
      pages: metadata.pages
        ? metadata.pages.split(",").map((p: string) => parseInt(p.trim(), 10))
        : undefined,
    });
  }),

  REORDER: bufferTransformHandler("reorder", "reordered.pdf", async (buffer, metadata) => {
    if (!metadata.pageOrder || metadata.pageOrder.length === 0) {
      throw new Error("pageOrder is required for reorder");
    }
    return reorderPages(buffer, { pageOrder: metadata.pageOrder });
  }),

  PAGE_NUMBERS: bufferTransformHandler("page numbers", "numbered.pdf", async (buffer, metadata) => {
    return addPageNumbers(buffer, {
      position: metadata.position as any,
      startFrom: metadata.startFrom,
      fontSize: metadata.fontSize,
      format: metadata.format,
    });
  }),

  ENCRYPT: bufferTransformHandler("encrypt", "encrypted.pdf", async (buffer, metadata) => {
    if (!metadata.password) {
      throw new Error("Password is required for encrypt");
    }
    return encryptPdf(buffer, { password: metadata.password });
  }),

  FLATTEN: bufferTransformHandler("flatten", "flattened.pdf", async (buffer) => {
    return flattenPdf(buffer);
  }),

  REDACT: bufferTransformHandler("redact", "redacted.pdf", async (buffer, metadata) => {
    if (!metadata.regions || metadata.regions.length === 0) {
      throw new Error("At least one redaction region is required");
    }
    const result = await redactPdf(buffer, { regions: metadata.regions });
    // Attach extra metadata for the status update
    metadata.regionCount = metadata.regions.length;
    return result;
  }),

  SIGN: bufferTransformHandler("sign", "signed.pdf", async (buffer, metadata) => {
    if (!metadata.signatureImageBase64) {
      throw new Error("Signature image is required for sign");
    }
    return addSignature(buffer, {
      signatureImageBase64: metadata.signatureImageBase64,
      page: metadata.page ?? 1,
      x: metadata.x ?? 50,
      y: metadata.y ?? 50,
      width: metadata.width,
      height: metadata.height,
    });
  }),

  ADD_TEXT: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "add text");
    if (!metadata.text && (!metadata.placements || metadata.placements.length === 0)) {
      throw new Error("Either 'text' or 'placements' is required for add text");
    }
    const result = await addTextToPdf({
      inputKey,
      outputKey: `${metadata._outputBase}/text-added.pdf`,
      text: metadata.text,
      page: metadata.page ?? 0,
      x: metadata.x ?? 0,
      y: metadata.y ?? 0,
      fontSize: metadata.fontSize,
      color: metadata.color,
      placements: metadata.placements,
    });
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: { ...metadata, pageCount: result.pageCount },
    });
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },

  WATERMARK: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "watermark");
    if (!metadata.text) {
      throw new Error("Text is required for watermark");
    }
    const result = await addWatermark({
      inputKey,
      outputKey: `${metadata._outputBase}/watermarked.pdf`,
      text: metadata.text,
      fontSize: metadata.fontSize,
      opacity: metadata.opacity,
      rotation: metadata.rotation,
      color: metadata.color,
    });
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: { ...metadata, pageCount: result.pageCount },
    });
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },
};
