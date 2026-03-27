import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { logger } from "../lib/logger";
import { processJob } from "./processor";

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

connection.on("connect", () => {
  logger.info("Redis connected");
});

export const pdfQueue = new Queue("pdf-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  },
});

let worker: Worker | null = null;

export function startWorker(concurrency = 3): Worker {
  if (worker) return worker;

  worker = new Worker(
    "pdf-processing",
    async (job) => {
      logger.info({ jobId: job.id, type: job.name, data: job.data }, "Processing job");
      return processJob(job);
    },
    {
      connection,
      concurrency,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, name: job?.name, err: err.message },
      "Job failed"
    );
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ jobId }, "Job stalled");
  });

  logger.info({ concurrency }, "BullMQ worker started");

  return worker;
}

export const queueEvents = new QueueEvents("pdf-processing", { connection });

queueEvents.on("waiting", ({ jobId }) => {
  logger.debug({ jobId }, "Job waiting");
});

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    pdfQueue.getWaitingCount(),
    pdfQueue.getActiveCount(),
    pdfQueue.getCompletedCount(),
    pdfQueue.getFailedCount(),
    pdfQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

export async function closeQueue() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  await pdfQueue.close();
  await queueEvents.close();
  await connection.quit();
  logger.info("Queue connections closed");
}
