import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { NotFoundError, PlanLimitError } from "../lib/errors";
import { getPdfQueue } from "../worker/queue";
import { CreateJobInput, ListJobsInput } from "./schemas";
import { logger } from "../lib/logger";

// Generous defaults for anonymous/no-auth usage
const DEFAULT_PLAN_LIMITS = {
  maxJobsPerMonth: -1,    // unlimited
  maxFileSizeMB: 100,
  maxPagesPerJob: 10000,
  concurrentJobs: -1,     // unlimited
};

/** File TTL: 30 minutes */
const FILE_TTL_MINUTES = 30;

export async function createJob(sessionId: string, input: CreateJobInput) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + FILE_TTL_MINUTES);

  const job = await prisma.job.create({
    data: {
      sessionId,
      type: input.type as JobType,
      status: JobStatus.PENDING,
      inputUrl: input.inputUrl ?? null,
      metadata: input.metadata as any,
      expiresAt,
    },
  });

  // Log usage
  await prisma.usageLog.create({
    data: {
      sessionId,
      jobType: input.type as JobType,
      creditsUsed: 1,
    },
  });

  // Enqueue to BullMQ
  await getPdfQueue().add(
    `pdf-${input.type.toLowerCase()}`,
    {
      jobId: job.id,
      userId: sessionId,
      type: input.type,
      inputUrl: input.inputUrl,
      metadata: input.metadata,
      planLimits: DEFAULT_PLAN_LIMITS,
    },
    {
      jobId: job.id,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    }
  );

  logger.info({ jobId: job.id, type: input.type, sessionId }, "Job created and enqueued");

  return job;
}

export async function getJob(sessionId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, sessionId },
  });

  if (!job) {
    throw new NotFoundError("Job", jobId);
  }

  return job;
}

export async function listJobs(sessionId: string, input: ListJobsInput) {
  const where: any = { sessionId };
  if (input.status) where.status = input.status;
  if (input.type) where.type = input.type;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function cancelJob(sessionId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, sessionId },
  });

  if (!job) {
    throw new NotFoundError("Job", jobId);
  }

  if (job.status !== JobStatus.PENDING) {
    throw new PlanLimitError("Can only cancel pending jobs");
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.FAILED, errorMessage: "Cancelled by user" },
  });

  // Remove from queue
  const bullJob = await getPdfQueue().getJob(jobId);
  if (bullJob) {
    await bullJob.remove();
  }

  return updated;
}

export async function getUsageStats(sessionId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalJobs, monthlyUsage, byType] = await Promise.all([
    prisma.job.count({ where: { sessionId } }),
    prisma.usageLog.count({
      where: { sessionId, timestamp: { gte: startOfMonth } },
    }),
    prisma.usageLog.groupBy({
      by: ["jobType"],
      where: { sessionId, timestamp: { gte: startOfMonth } },
      _count: true,
    }),
  ]);

  return {
    totalJobs,
    monthlyUsage,
    byType: byType.map((item) => ({
      type: item.jobType,
      count: item._count,
    })),
  };
}
