import { FastifyInstance } from "fastify";
import { createJobSchema, listJobsSchema, jobIdParamSchema } from "./schemas";
import { createJob, getJob, listJobs, cancelJob, getUsageStats } from "./service";
import { getUploadUrl, getDownloadUrl } from "../storage/r2";

const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function jobsRouter(app: FastifyInstance) {
  app.post("/jobs", async (request, reply) => {
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

  // Presigned upload URL
  app.post("/jobs/upload-url", async (request, reply) => {
    const { fileName, contentType } = request.body as {
      fileName: string;
      contentType: string;
    };
    const key = `uploads/${ANONYMOUS_USER_ID}/${Date.now()}-${fileName}`;
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
    const url = await getDownloadUrl(job.outputUrl);
    return reply.send({ downloadUrl: url, expiresIn: 3600 });
  });
}
