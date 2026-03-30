import { Job } from "bullmq";
import { JobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { getObjectBuffer, putObject } from "../storage/r2";
import { getOperationHandler, OperationContext } from "./operations/index";
import { validateExternalUrl } from "../lib/url-validator";

interface JobData {
  jobId: string;
  userId: string;
  type: string;
  inputUrl?: string;
  metadata: Record<string, any>;
  planLimits: {
    maxFileSizeMB: number;
    maxPagesPerJob: number;
  };
}

async function updateJobStatus(
  jobId: string,
  status: JobStatus | string,
  data?: { outputUrl?: string; errorMessage?: string; metadata?: any }
) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: status as JobStatus,
      ...(data?.outputUrl ? { outputUrl: data.outputUrl } : {}),
      ...(data?.errorMessage ? { errorMessage: data.errorMessage } : {}),
      ...(data?.metadata ? { metadata: data.metadata } : {}),
    },
  });
}

async function notifyWebhook(userId: string, event: string, payload: any) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { userId, active: true, events: { hasSome: [event, "*"] } },
    });
    for (const webhook of webhooks) {
      try {
        // Validate webhook URL to prevent SSRF attacks
        validateExternalUrl(webhook.url);

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

  const handler = getOperationHandler(type);
  if (!handler) {
    throw new Error(`Unknown job type: ${type}`);
  }

  await updateJobStatus(jobId, JobStatus.PROCESSING);

  const ctx: OperationContext = {
    getFile: getObjectBuffer,
    putFile: putObject,
    updateStatus: updateJobStatus,
  };

  // Attach output base path so handlers can build output keys
  const enrichedMetadata = { ...metadata, _outputBase: outputBase };

  try {
    const result = await handler(jobId, enrichedMetadata, ctx);

    await notifyWebhook(userId, "job.completed", { jobId, type, status: "DONE", result });

    if (metadata.callbackUrl) {
      try {
        // Validate callback URL to prevent SSRF attacks
        validateExternalUrl(metadata.callbackUrl);

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
    await notifyWebhook(userId, "job.failed", { jobId, type, status: "FAILED", error: errorMessage });
    logger.error({ jobId, type, err: errorMessage }, "Job processing failed");
    throw err;
  }
}
