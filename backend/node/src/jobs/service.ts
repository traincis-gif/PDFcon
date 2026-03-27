import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { NotFoundError, PlanLimitError } from "../lib/errors";
import { pdfQueue } from "../worker/queue";
import { CreateJobInput, ListJobsInput } from "./schemas";
import { logger } from "../lib/logger";

interface PlanLimits {
  maxJobsPerMonth: number;
  maxFileSizeMB: number;
  maxPagesPerJob: number;
  concurrentJobs: number;
  retentionDays: number;
}

export async function checkPlanLimits(userId: string, planLimits: PlanLimits) {
  // Check monthly job count (-1 = unlimited)
  if (planLimits.maxJobsPerMonth !== -1) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const jobCount = await prisma.usageLog.count({
      where: {
        userId,
        timestamp: { gte: startOfMonth },
      },
    });

    if (jobCount >= planLimits.maxJobsPerMonth) {
      throw new PlanLimitError(
        `Monthly job limit reached (${planLimits.maxJobsPerMonth} jobs/month). Upgrade your plan for more.`,
        { currentUsage: jobCount, limit: planLimits.maxJobsPerMonth }
      );
    }
  }

  // Check concurrent jobs
  if (planLimits.concurrentJobs !== -1) {
    const activeJobs = await prisma.job.count({
      where: {
        userId,
        status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
      },
    });

    if (activeJobs >= planLimits.concurrentJobs) {
      throw new PlanLimitError(
        `Concurrent job limit reached (${planLimits.concurrentJobs}). Wait for current jobs to finish.`,
        { activeJobs, limit: planLimits.concurrentJobs }
      );
    }
  }
}

export async function createJob(userId: string, plan: any, input: CreateJobInput) {
  const planLimits = plan.limits as PlanLimits;
  await checkPlanLimits(userId, planLimits);

  const retentionDays = planLimits.retentionDays;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const job = await prisma.job.create({
    data: {
      userId,
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
      userId,
      jobType: input.type as JobType,
      creditsUsed: 1,
    },
  });

  // Enqueue to BullMQ
  await pdfQueue.add(
    `pdf-${input.type.toLowerCase()}`,
    {
      jobId: job.id,
      userId,
      type: input.type,
      inputUrl: input.inputUrl,
      metadata: input.metadata,
      planLimits,
    },
    {
      jobId: job.id,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    }
  );

  logger.info({ jobId: job.id, type: input.type, userId }, "Job created and enqueued");

  return job;
}

export async function getJob(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
  });

  if (!job) {
    throw new NotFoundError("Job", jobId);
  }

  return job;
}

export async function listJobs(userId: string, input: ListJobsInput) {
  const where: any = { userId };
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

export async function cancelJob(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
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
  const bullJob = await pdfQueue.getJob(jobId);
  if (bullJob) {
    await bullJob.remove();
  }

  return updated;
}

export async function getUsageStats(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalJobs, monthlyUsage, byType] = await Promise.all([
    prisma.job.count({ where: { userId } }),
    prisma.usageLog.count({
      where: { userId, timestamp: { gte: startOfMonth } },
    }),
    prisma.usageLog.groupBy({
      by: ["jobType"],
      where: { userId, timestamp: { gte: startOfMonth } },
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
