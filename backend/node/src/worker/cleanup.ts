import { JobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { deleteObject } from "../storage/r2";
import { logger } from "../lib/logger";

/** Maximum number of expired jobs to clean up per run to avoid long-running operations */
const CLEANUP_BATCH_SIZE = 100;

/**
 * Cleans up expired jobs and their associated R2 files and usage logs.
 * Designed to run as a repeatable BullMQ job on an hourly schedule.
 */
export async function cleanupExpiredJobs(): Promise<{ deletedCount: number }> {
  const now = new Date();

  // Find expired jobs that are in a terminal state (DONE or FAILED)
  const expiredJobs = await prisma.job.findMany({
    where: {
      expiresAt: { lt: now },
      status: { in: [JobStatus.DONE, JobStatus.FAILED] },
    },
    take: CLEANUP_BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      inputUrl: true,
      outputUrl: true,
      metadata: true,
    },
  });

  if (expiredJobs.length === 0) {
    logger.debug("No expired jobs to clean up");
    return { deletedCount: 0 };
  }

  let deletedCount = 0;

  for (const job of expiredJobs) {
    try {
      // Collect all R2 keys to delete for this job
      const keysToDelete: string[] = [];

      if (job.inputUrl) {
        keysToDelete.push(job.inputUrl);
      }
      if (job.outputUrl) {
        keysToDelete.push(job.outputUrl);
      }

      // Extract fileKeys and outputKeys from metadata
      const metadata = job.metadata as Record<string, unknown> | null;
      if (metadata) {
        if (Array.isArray(metadata.fileKeys)) {
          for (const key of metadata.fileKeys) {
            if (typeof key === "string") {
              keysToDelete.push(key);
            }
          }
        }
        if (Array.isArray(metadata.outputKeys)) {
          for (const key of metadata.outputKeys) {
            if (typeof key === "string") {
              keysToDelete.push(key);
            }
          }
        }
      }

      // Delete R2 objects (best-effort, don't fail the whole cleanup if one delete fails)
      for (const key of keysToDelete) {
        try {
          await deleteObject(key);
        } catch (err) {
          logger.warn({ key, jobId: job.id, err }, "Failed to delete R2 object during cleanup");
        }
      }

      // Delete the job record. Usage logs are retained for billing/analytics
      // purposes since UsageLog doesn't have a direct jobId reference.
      await prisma.job.delete({ where: { id: job.id } });

      deletedCount++;
    } catch (err) {
      logger.error({ jobId: job.id, err }, "Failed to clean up expired job");
    }
  }

  logger.info({ deletedCount, totalExpired: expiredJobs.length }, "Expired job cleanup complete");
  return { deletedCount };
}
