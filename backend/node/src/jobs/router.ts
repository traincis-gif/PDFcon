import { FastifyInstance } from "fastify";
import { createJobSchema, listJobsSchema, jobIdParamSchema, uploadUrlSchema } from "./schemas";
import { createJob, getJob, listJobs, cancelJob, getUsageStats } from "./service";
import { getUploadUrl, getDownloadUrl } from "../storage/r2";
import {
  sanitizeFileName,
  validateFileType,
  validateFileSize,
  validateStorageKey,
} from "../middleware/security";

const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function jobsRouter(app: FastifyInstance) {
  // Stricter rate limit for job creation endpoints
  const jobCreationRateLimit = {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
  };

  app.post("/jobs", jobCreationRateLimit, async (request, reply) => {
    const body = createJobSchema.parse(request.body);
    const job = await createJob(ANONYMOUS_USER_ID, body);
    return reply.status(201).send(job);
  });

  app.get("/jobs", async (request, reply) => {
    const query = listJobsSchema.parse(request.query);
    const result = await listJobs(ANONYMOUS_USER_ID, query);
    return reply.send(result);
  });

  app.get("/jobs/:id", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const job = await getJob(ANONYMOUS_USER_ID, id);
    return reply.send(job);
  });

  app.delete("/jobs/:id", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const job = await cancelJob(ANONYMOUS_USER_ID, id);
    return reply.send(job);
  });

  app.get("/jobs/usage/stats", async (request, reply) => {
    const stats = await getUsageStats(ANONYMOUS_USER_ID);
    return reply.send(stats);
  });

  // Presigned upload URL — with file type and size validation
  app.post("/jobs/upload-url", jobCreationRateLimit, async (request, reply) => {
    const { fileName, contentType, fileSize } = uploadUrlSchema.parse(request.body);

    // Validate file type
    validateFileType(contentType, fileName);

    // Validate file size if provided
    if (fileSize !== undefined) {
      validateFileSize(fileSize);
    }

    // Sanitize the file name to prevent path traversal
    const safeName = sanitizeFileName(fileName);

    const key = `uploads/${ANONYMOUS_USER_ID}/${Date.now()}-${safeName}`;

    // Validate the constructed key
    validateStorageKey(key);

    const url = await getUploadUrl(key, contentType);
    return reply.send({ uploadUrl: url, key });
  });

  // Presigned download URL
  app.get("/jobs/:id/download", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const job = await getJob(ANONYMOUS_USER_ID, id);
    if (!job.outputUrl) {
      return reply.status(404).send({
        error: { code: "NOT_READY", message: "Job output not yet available" },
      });
    }

    // Validate the storage key before generating a URL
    validateStorageKey(job.outputUrl);

    const url = await getDownloadUrl(job.outputUrl);
    return reply.send({ downloadUrl: url, expiresIn: 3600 });
  });
}
