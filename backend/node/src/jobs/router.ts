import { FastifyInstance } from "fastify";
import { createJobSchema, listJobsSchema, jobIdParamSchema } from "./schemas";
import { createJob, getJob, listJobs, cancelJob, getUsageStats } from "./service";
import { authenticate } from "../middleware/auth";
import { getUploadUrl, getDownloadUrl } from "../storage/r2";

export async function jobsRouter(app: FastifyInstance) {
  // All routes require auth
  app.addHook("preHandler", authenticate);

  app.post("/jobs", async (request, reply) => {
    const body = createJobSchema.parse(request.body);
    const job = await createJob(request.userId!, request.userPlan, body);
    return reply.status(201).send(job);
  });

  app.get("/jobs", async (request, reply) => {
    const query = listJobsSchema.parse(request.query);
    const result = await listJobs(request.userId!, query);
    return reply.send(result);
  });

  app.get("/jobs/:id", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const job = await getJob(request.userId!, id);
    return reply.send(job);
  });

  app.delete("/jobs/:id", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const job = await cancelJob(request.userId!, id);
    return reply.send(job);
  });

  app.get("/jobs/usage/stats", async (request, reply) => {
    const stats = await getUsageStats(request.userId!);
    return reply.send(stats);
  });

  // Presigned upload URL
  app.post("/jobs/upload-url", async (request, reply) => {
    const { fileName, contentType } = request.body as {
      fileName: string;
      contentType: string;
    };
    const key = `uploads/${request.userId!}/${Date.now()}-${fileName}`;
    const url = await getUploadUrl(key, contentType);
    return reply.send({ uploadUrl: url, key });
  });

  // Presigned download URL
  app.get("/jobs/:id/download", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const job = await getJob(request.userId!, id);
    if (!job.outputUrl) {
      return reply.status(404).send({
        error: { code: "NOT_READY", message: "Job output not yet available" },
      });
    }
    const url = await getDownloadUrl(job.outputUrl);
    return reply.send({ downloadUrl: url, expiresIn: 3600 });
  });
}
