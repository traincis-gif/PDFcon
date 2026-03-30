import { Job } from "bullmq";
import { JobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { getObjectBuffer, putObject } from "../storage/r2";
import { mergePdfs } from "../services/pdf-merge";
import { splitPdf } from "../services/pdf-split";
import { compressPdf } from "../services/pdf-compress";
import { pdfToPng } from "../services/pdf-to-png";
import { pdfToJpg } from "../services/pdf-to-jpg";
import { extractText } from "../services/pdf-to-txt";
import { addTextToPdf } from "../services/pdf-add-text";
import { addWatermark } from "../services/pdf-watermark";
import { rotatePdf } from "../services/pdf-rotate";
import { reorderPages } from "../services/pdf-reorder";
import { addPageNumbers } from "../services/pdf-page-numbers";
import { encryptPdf } from "../services/pdf-encrypt";
import { flattenPdf } from "../services/pdf-flatten";
import { redactPdf } from "../services/pdf-redact";
import { addSignature } from "../services/pdf-sign";
import { ocrExtractFromPdf } from "../services/ocr";
import { imagesToPdf } from "../services/img-to-pdf";
import { convertWithLibreOffice } from "../services/convert-libreoffice";

interface JobData {
  jobId: string;
  userId: string;
  type: string;
  inputUrl?: string;
  metadata: {
    fileKeys?: string[];
    pages?: string;
    quality?: "low" | "medium" | "high";
    dpi?: number;
    text?: string;
    page?: number;
    x?: number;
    y?: number;
    fontSize?: number;
    color?: { r: number; g: number; b: number };
    opacity?: number;
    rotation?: number;
    angle?: 90 | 180 | 270;
    pageOrder?: number[];
    position?: string;
    startFrom?: number;
    format?: string;
    password?: string;
    regions?: { page: number; x: number; y: number; width: number; height: number }[];
    signatureImageBase64?: string;
    width?: number;
    height?: number;
    language?: string;
    callbackUrl?: string;
  };
  planLimits: {
    maxFileSizeMB: number;
    maxPagesPerJob: number;
  };
}

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  data?: { outputUrl?: string; errorMessage?: string; metadata?: any }
) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status,
      ...(data?.outputUrl ? { outputUrl: data.outputUrl } : {}),
      ...(data?.errorMessage ? { errorMessage: data.errorMessage } : {}),
      ...(data?.metadata ? { metadata: data.metadata } : {}),
    },
  });
}

async function notifyWebhook(userId: string, event: string, payload: any) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        active: true,
        events: { hasSome: [event, "*"] },
      },
    });

    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Secret": webhook.secret,
            "X-Event-Type": event,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        logger.debug({ webhookId: webhook.id, event }, "Webhook delivered");
      } catch (err) {
        logger.warn({ webhookId: webhook.id, err }, "Webhook delivery failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error fetching webhooks");
  }
}

/** Helper: get the first file key from metadata, throw if missing */
function requireFileKey(metadata: JobData["metadata"], label: string): string {
  if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
    throw new Error(`Input file key required for ${label}`);
  }
  return metadata.fileKeys[0];
}

export async function processJob(job: Job<JobData>): Promise<any> {
  const { jobId, userId, type, metadata } = job.data;
  const outputBase = `outputs/${userId}/${jobId}`;

  await updateJobStatus(jobId, JobStatus.PROCESSING);

  try {
    let result: any;

    switch (type) {
      case "MERGE": {
        if (!metadata.fileKeys || metadata.fileKeys.length < 2) {
          throw new Error("At least 2 file keys required for merge");
        }
        result = await mergePdfs({
          fileKeys: metadata.fileKeys,
          outputKey: `${outputBase}/merged.pdf`,
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKey,
          metadata: { ...metadata, pageCount: result.pageCount },
        });
        break;
      }

      case "SPLIT": {
        const inputKey = requireFileKey(metadata, "split");
        result = await splitPdf({
          inputKey,
          outputKeyPrefix: outputBase,
          pages: metadata.pages || "all",
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKeys[0],
          metadata: { ...metadata, outputKeys: result.outputKeys, partCount: result.partCount },
        });
        break;
      }

      case "COMPRESS": {
        const inputKey = requireFileKey(metadata, "compress");
        result = await compressPdf({
          inputKey,
          outputKey: `${outputBase}/compressed.pdf`,
          quality: metadata.quality || "medium",
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKey,
          metadata: {
            ...metadata,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            ratio: result.ratio,
          },
        });
        break;
      }

      case "PDF_TO_PNG": {
        const inputKey = requireFileKey(metadata, "PDF to PNG");
        result = await pdfToPng({
          inputKey,
          outputKeyPrefix: outputBase,
          dpi: metadata.dpi || 150,
          pages: metadata.pages,
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKeys[0],
          metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
        });
        break;
      }

      case "PDF_TO_JPG": {
        const inputKey = requireFileKey(metadata, "PDF to JPG");
        result = await pdfToJpg({
          inputKey,
          outputKeyPrefix: outputBase,
          dpi: metadata.dpi || 150,
          pages: metadata.pages,
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKeys[0],
          metadata: { ...metadata, outputKeys: result.outputKeys, pageCount: result.pageCount },
        });
        break;
      }

      case "PDF_TO_TXT": {
        const inputKey = requireFileKey(metadata, "PDF to TXT");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const text = await extractText(pdfBuffer);
        const outputKey = `${outputBase}/extracted.txt`;
        await putObject(outputKey, Buffer.from(text, "utf-8"), "text/plain");
        result = { outputKey, textLength: text.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, textLength: text.length },
        });
        break;
      }

      case "PDF_TO_DOCX": {
        const inputKey = requireFileKey(metadata, "PDF to DOCX");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const docxBuffer = await convertWithLibreOffice(pdfBuffer, "pdf", "docx");
        const outputKey = `${outputBase}/converted.docx`;
        await putObject(outputKey, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        result = { outputKey, size: docxBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: docxBuffer.length },
        });
        break;
      }

      case "PDF_TO_XLSX": {
        const inputKey = requireFileKey(metadata, "PDF to XLSX");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const xlsxBuffer = await convertWithLibreOffice(pdfBuffer, "pdf", "xlsx");
        const outputKey = `${outputBase}/converted.xlsx`;
        await putObject(outputKey, xlsxBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        result = { outputKey, size: xlsxBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: xlsxBuffer.length },
        });
        break;
      }

      case "PDF_TO_PPTX": {
        const inputKey = requireFileKey(metadata, "PDF to PPTX");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const pptxBuffer = await convertWithLibreOffice(pdfBuffer, "pdf", "pptx");
        const outputKey = `${outputBase}/converted.pptx`;
        await putObject(outputKey, pptxBuffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        result = { outputKey, size: pptxBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: pptxBuffer.length },
        });
        break;
      }

      case "DOCX_TO_PDF": {
        const inputKey = requireFileKey(metadata, "DOCX to PDF");
        const docxBuffer = await getObjectBuffer(inputKey);
        const pdfBuffer = await convertWithLibreOffice(docxBuffer, "docx", "pdf");
        const outputKey = `${outputBase}/converted.pdf`;
        await putObject(outputKey, pdfBuffer, "application/pdf");
        result = { outputKey, size: pdfBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: pdfBuffer.length },
        });
        break;
      }

      case "XLSX_TO_PDF": {
        const inputKey = requireFileKey(metadata, "XLSX to PDF");
        const xlsxBuffer = await getObjectBuffer(inputKey);
        const pdfBuffer = await convertWithLibreOffice(xlsxBuffer, "xlsx", "pdf");
        const outputKey = `${outputBase}/converted.pdf`;
        await putObject(outputKey, pdfBuffer, "application/pdf");
        result = { outputKey, size: pdfBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: pdfBuffer.length },
        });
        break;
      }

      case "PPTX_TO_PDF": {
        const inputKey = requireFileKey(metadata, "PPTX to PDF");
        const pptxBuffer = await getObjectBuffer(inputKey);
        const pdfBuffer = await convertWithLibreOffice(pptxBuffer, "pptx", "pdf");
        const outputKey = `${outputBase}/converted.pdf`;
        await putObject(outputKey, pdfBuffer, "application/pdf");
        result = { outputKey, size: pdfBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: pdfBuffer.length },
        });
        break;
      }

      case "HTML_TO_PDF": {
        const inputKey = requireFileKey(metadata, "HTML to PDF");
        const htmlBuffer = await getObjectBuffer(inputKey);
        const pdfBuffer = await convertWithLibreOffice(htmlBuffer, "html", "pdf");
        const outputKey = `${outputBase}/converted.pdf`;
        await putObject(outputKey, pdfBuffer, "application/pdf");
        result = { outputKey, size: pdfBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: pdfBuffer.length },
        });
        break;
      }

      case "IMG_TO_PDF": {
        if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
          throw new Error("At least one image file key required for IMG to PDF");
        }
        const imageBuffers = await Promise.all(
          metadata.fileKeys.map(async (key) => {
            const buffer = await getObjectBuffer(key);
            const ext = key.split(".").pop()?.toLowerCase() || "";
            const mimetype = ext === "png" ? "image/png" : "image/jpeg";
            return { buffer, mimetype };
          })
        );
        const pdfBuffer = await imagesToPdf(imageBuffers);
        const outputKey = `${outputBase}/images.pdf`;
        await putObject(outputKey, pdfBuffer, "application/pdf");
        result = { outputKey, size: pdfBuffer.length, imageCount: imageBuffers.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: pdfBuffer.length, imageCount: imageBuffers.length },
        });
        break;
      }

      case "ADD_TEXT": {
        const inputKey = requireFileKey(metadata, "add text");
        if (!metadata.text) {
          throw new Error("Text is required for add text");
        }
        result = await addTextToPdf({
          inputKey,
          outputKey: `${outputBase}/text-added.pdf`,
          text: metadata.text,
          page: metadata.page ?? 0,
          x: metadata.x ?? 0,
          y: metadata.y ?? 0,
          fontSize: metadata.fontSize,
          color: metadata.color,
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKey,
          metadata: { ...metadata, pageCount: result.pageCount },
        });
        break;
      }

      case "WATERMARK": {
        const inputKey = requireFileKey(metadata, "watermark");
        if (!metadata.text) {
          throw new Error("Text is required for watermark");
        }
        result = await addWatermark({
          inputKey,
          outputKey: `${outputBase}/watermarked.pdf`,
          text: metadata.text,
          fontSize: metadata.fontSize,
          opacity: metadata.opacity,
          rotation: metadata.rotation,
          color: metadata.color,
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKey,
          metadata: { ...metadata, pageCount: result.pageCount },
        });
        break;
      }

      case "ROTATE": {
        const inputKey = requireFileKey(metadata, "rotate");
        if (!metadata.angle) {
          throw new Error("Angle is required for rotate (90, 180, or 270)");
        }
        const pdfBuffer = await getObjectBuffer(inputKey);
        const rotatedBuffer = await rotatePdf(pdfBuffer, {
          angle: metadata.angle,
          pages: metadata.pages
            ? metadata.pages.split(",").map((p) => parseInt(p.trim(), 10))
            : undefined,
        });
        const outputKey = `${outputBase}/rotated.pdf`;
        await putObject(outputKey, rotatedBuffer, "application/pdf");
        result = { outputKey, size: rotatedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: rotatedBuffer.length },
        });
        break;
      }

      case "REORDER": {
        const inputKey = requireFileKey(metadata, "reorder");
        if (!metadata.pageOrder || metadata.pageOrder.length === 0) {
          throw new Error("pageOrder is required for reorder");
        }
        const pdfBuffer = await getObjectBuffer(inputKey);
        const reorderedBuffer = await reorderPages(pdfBuffer, {
          pageOrder: metadata.pageOrder,
        });
        const outputKey = `${outputBase}/reordered.pdf`;
        await putObject(outputKey, reorderedBuffer, "application/pdf");
        result = { outputKey, size: reorderedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: reorderedBuffer.length },
        });
        break;
      }

      case "PAGE_NUMBERS": {
        const inputKey = requireFileKey(metadata, "page numbers");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const numberedBuffer = await addPageNumbers(pdfBuffer, {
          position: metadata.position as any,
          startFrom: metadata.startFrom,
          fontSize: metadata.fontSize,
          format: metadata.format,
        });
        const outputKey = `${outputBase}/numbered.pdf`;
        await putObject(outputKey, numberedBuffer, "application/pdf");
        result = { outputKey, size: numberedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: numberedBuffer.length },
        });
        break;
      }

      case "ENCRYPT": {
        const inputKey = requireFileKey(metadata, "encrypt");
        if (!metadata.password) {
          throw new Error("Password is required for encrypt");
        }
        const pdfBuffer = await getObjectBuffer(inputKey);
        const encryptedBuffer = await encryptPdf(pdfBuffer, {
          password: metadata.password,
        });
        const outputKey = `${outputBase}/encrypted.pdf`;
        await putObject(outputKey, encryptedBuffer, "application/pdf");
        result = { outputKey, size: encryptedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: encryptedBuffer.length },
        });
        break;
      }

      case "FLATTEN": {
        const inputKey = requireFileKey(metadata, "flatten");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const flattenedBuffer = await flattenPdf(pdfBuffer);
        const outputKey = `${outputBase}/flattened.pdf`;
        await putObject(outputKey, flattenedBuffer, "application/pdf");
        result = { outputKey, size: flattenedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: flattenedBuffer.length },
        });
        break;
      }

      case "REDACT": {
        const inputKey = requireFileKey(metadata, "redact");
        if (!metadata.regions || metadata.regions.length === 0) {
          throw new Error("At least one redaction region is required");
        }
        const pdfBuffer = await getObjectBuffer(inputKey);
        const redactedBuffer = await redactPdf(pdfBuffer, {
          regions: metadata.regions,
        });
        const outputKey = `${outputBase}/redacted.pdf`;
        await putObject(outputKey, redactedBuffer, "application/pdf");
        result = { outputKey, size: redactedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: redactedBuffer.length, regionCount: metadata.regions.length },
        });
        break;
      }

      case "SIGN": {
        const inputKey = requireFileKey(metadata, "sign");
        if (!metadata.signatureImageBase64) {
          throw new Error("Signature image is required for sign");
        }
        const pdfBuffer = await getObjectBuffer(inputKey);
        const signedBuffer = await addSignature(pdfBuffer, {
          signatureImageBase64: metadata.signatureImageBase64,
          page: metadata.page ?? 1,
          x: metadata.x ?? 50,
          y: metadata.y ?? 50,
          width: metadata.width,
          height: metadata.height,
        });
        const outputKey = `${outputBase}/signed.pdf`;
        await putObject(outputKey, signedBuffer, "application/pdf");
        result = { outputKey, size: signedBuffer.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, size: signedBuffer.length },
        });
        break;
      }

      case "OCR": {
        const inputKey = requireFileKey(metadata, "OCR");
        const pdfBuffer = await getObjectBuffer(inputKey);
        const ocrResult = await ocrExtractFromPdf(pdfBuffer, {
          language: metadata.language,
          pages: metadata.pages,
        });
        const outputKey = `${outputBase}/ocr-result.txt`;
        await putObject(outputKey, Buffer.from(ocrResult.text, "utf-8"), "text/plain");
        result = { outputKey, textLength: ocrResult.text.length, pageCount: ocrResult.pageTexts.length };
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: outputKey,
          metadata: { ...metadata, textLength: ocrResult.text.length, pageCount: ocrResult.pageTexts.length },
        });
        break;
      }

      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    // Notify via webhooks
    await notifyWebhook(userId, "job.completed", {
      jobId,
      type,
      status: "DONE",
      result,
    });

    // Call the job-specific callback URL if provided
    if (metadata.callbackUrl) {
      try {
        await fetch(metadata.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, type, status: "DONE", result }),
          signal: AbortSignal.timeout(10000),
        });
      } catch (err) {
        logger.warn({ callbackUrl: metadata.callbackUrl, err }, "Callback URL delivery failed");
      }
    }

    logger.info({ jobId, type }, "Job processing complete");
    return result;
  } catch (err: any) {
    const errorMessage = err.message || "Unknown processing error";
    await updateJobStatus(jobId, JobStatus.FAILED, { errorMessage });

    await notifyWebhook(userId, "job.failed", {
      jobId,
      type,
      status: "FAILED",
      error: errorMessage,
    });

    logger.error({ jobId, type, err: errorMessage }, "Job processing failed");
    throw err; // Re-throw for BullMQ retry
  }
}
