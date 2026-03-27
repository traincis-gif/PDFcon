import { Job } from "bullmq";
import { JobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { mergePdfs } from "../services/pdf-merge";
import { splitPdf } from "../services/pdf-split";
import { compressPdf } from "../services/pdf-compress";
import { pdfToPng } from "../services/pdf-to-png";

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
        if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
          throw new Error("Input file key required for split");
        }
        result = await splitPdf({
          inputKey: metadata.fileKeys[0],
          outputKeyPrefix: outputBase,
          pages: metadata.pages || "all",
        });
        await updateJobStatus(jobId, JobStatus.DONE, {
          outputUrl: result.outputKeys[0], // Primary output
          metadata: { ...metadata, outputKeys: result.outputKeys, partCount: result.partCount },
        });
        break;
      }

      case "COMPRESS": {
        if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
          throw new Error("Input file key required for compress");
        }
        result = await compressPdf({
          inputKey: metadata.fileKeys[0],
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
        if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
          throw new Error("Input file key required for PDF to PNG");
        }
        result = await pdfToPng({
          inputKey: metadata.fileKeys[0],
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
