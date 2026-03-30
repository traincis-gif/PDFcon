import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { logger } from "../lib/logger";
import { processJob } from "./processor";
import { cleanupExpiredJobs } from "./cleanup";

let connection: IORedis | null = null;
let pdfQueueInstance: Queue | null = null;
let worker: Worker | null = null;
let queueEventsInstance: QueueEvents | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });

    connection.on("error", (err) => {
      logger.error({ err: err.message }, "Redis connection error");
    });

    connection.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  return connection;
}

export function getPdfQueue(): Queue {
  if (!pdfQueueInstance) {
    pdfQueueInstance = new Queue("pdf-processing", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
    });
  }
  return pdfQueueInstance;
}

export function startWorker(concurrency = 3): Worker {
  if (worker) return worker;

  worker = new Worker(
    "pdf-processing",
    async (job) => {
      // Handle the scheduled cleanup job separately
      if (job.name === "cleanup-expired-jobs") {
        logger.info("Running scheduled cleanup of expired jobs");
        return cleanupExpiredJobs();
      }

      logger.info({ jobId: job.id, type: job.name, data: job.data }, "Processing job");
      return processJob(job);
    },
    {
      connection: getConnection(),
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
    logger.error({ err: err.message }, "Worker error");
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ jobId }, "Job stalled");
  });

  logger.info({ concurrency }, "BullMQ worker started");

  // Schedule the cleanup job to run every hour
  scheduleCleanup().catch((err) => {
    logger.error({ err }, "Failed to schedule cleanup job");
  });

  return worker;
}

export async function getQueueStats() {
  try {
    const queue = getPdfQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  } catch {
    return null;
  }
}

async function scheduleCleanup(): Promise<void> {
  const queue = getPdfQueue();

  // Add a repeatable job that triggers cleanup every hour
  await queue.add(
    "cleanup-expired-jobs",
    {},
    {
      repeat: { every: 60 * 60 * 1000 }, // every hour
      jobId: "cleanup-expired-jobs",
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 10 },
    }
  );

  logger.info("Scheduled hourly cleanup job for expired jobs");
}

export async function closeQueue() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (pdfQueueInstance) {
    await pdfQueueInstance.close();
    pdfQueueInstance = null;
  }
  if (queueEventsInstance) {
    await queueEventsInstance.close();
    queueEventsInstance = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
  logger.info("Queue connections closed");
}
