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
import { editPdfText } from "../../services/pdf-edit-text";
import { managePdfPages } from "../../services/pdf-manage-pages";

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
    ctx.reportProgress(10);
    const pdfBuffer = await ctx.getFile(inputKey);
    ctx.reportProgress(30);
    const resultBuffer = await transformFn(pdfBuffer, metadata);
    ctx.reportProgress(80);
    const outputKey = `${metadata._outputBase}/${outputFilename}`;
    await ctx.putFile(outputKey, resultBuffer, "application/pdf");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, size: resultBuffer.length },
    });
    ctx.reportProgress(100);
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
    ctx.reportProgress(10);
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
    ctx.reportProgress(90);
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: { ...metadata, pageCount: result.pageCount },
    });
    ctx.reportProgress(100);
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },

  EDIT_TEXT: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "edit text");
    if (!metadata.edits || metadata.edits.length === 0) {
      throw new Error("At least one text edit is required");
    }
    ctx.reportProgress(10);
    const result = await editPdfText({
      inputKey,
      outputKey: `${metadata._outputBase}/text-edited.pdf`,
      edits: metadata.edits,
    });
    ctx.reportProgress(90);
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: { ...metadata, editCount: result.editCount },
    });
    ctx.reportProgress(100);
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },

  WATERMARK: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "watermark");
    if (!metadata.text) {
      throw new Error("Text is required for watermark");
    }
    ctx.reportProgress(10);
    const result = await addWatermark({
      inputKey,
      outputKey: `${metadata._outputBase}/watermarked.pdf`,
      text: metadata.text,
      fontSize: metadata.fontSize,
      opacity: metadata.opacity,
      rotation: metadata.rotation,
      color: metadata.color,
    });
    ctx.reportProgress(90);
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: result.outputKey,
      metadata: { ...metadata, pageCount: result.pageCount },
    });
    ctx.reportProgress(100);
    return { outputKey: result.outputKey, contentType: "application/pdf" };
  },

  MANAGE_PAGES: async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, "manage pages");
    if (!metadata.operations || metadata.operations.length === 0) {
      throw new Error("At least one operation is required for manage pages");
    }
    ctx.reportProgress(10);
    const pdfBuffer = await ctx.getFile(inputKey);
    ctx.reportProgress(20);

    // Load any imported PDF files (additional file keys beyond the first)
    const importBuffers = new Map<string, Buffer>();
    if (metadata.fileKeys && metadata.fileKeys.length > 1) {
      // Build a mapping from fileId references in operations to actual file keys
      const importOps = (metadata.operations as any[]).filter(
        (op: any) => op.type === "import" && op.fileId
      );
      const uniqueFileIds = [...new Set(importOps.map((op: any) => op.fileId))];

      // The additional file keys (index 1+) correspond to imported files in order
      for (let i = 0; i < uniqueFileIds.length && i + 1 < metadata.fileKeys.length; i++) {
        const buf = await ctx.getFile(metadata.fileKeys[i + 1]);
        importBuffers.set(uniqueFileIds[i], buf);
      }
    }

    ctx.reportProgress(40);
    const result = await managePdfPages({
      inputBuffer: pdfBuffer,
      operations: metadata.operations,
      importBuffers: importBuffers.size > 0 ? importBuffers : undefined,
    });
    ctx.reportProgress(80);

    const outputKey = `${metadata._outputBase}/managed.pdf`;
    await ctx.putFile(outputKey, result.resultBuffer, "application/pdf");
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, pageCount: result.pageCount },
    });
    ctx.reportProgress(100);
    return { outputKey, contentType: "application/pdf" };
  },
};
