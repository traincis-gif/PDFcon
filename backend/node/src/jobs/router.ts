import crypto from "crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { createJobSchema, listJobsSchema, jobIdParamSchema, uploadUrlSchema } from "./schemas";
import { createJob, getJob, listJobs, cancelJob, getUsageStats } from "./service";
import { getUploadUrl, getDownloadUrl } from "../storage/r2";
import {
  sanitizeFileName,
  validateFileType,
  validateFileSize,
  validateStorageKey,
} from "../middleware/security";
import { getPdfQueue } from "../worker/queue";

/** Extract or create session ID from the pdflow-session cookie */
function getSessionId(request: FastifyRequest): string {
  const existing = request.cookies["pdflow-session"];
  if (existing) return existing;
  // Fallback — should not happen since preHandler in app.ts sets it,
  // but guard defensively.
  return crypto.randomUUID();
}

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
    const sessionId = getSessionId(request);
    const job = await createJob(sessionId, body);
    return reply.status(201).send(job);
  });

  app.get("/jobs", async (request, reply) => {
    const query = listJobsSchema.parse(request.query);
    const sessionId = getSessionId(request);
    const result = await listJobs(sessionId, query);
    return reply.send(result);
  });

  app.get("/jobs/:id", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const sessionId = getSessionId(request);
    const job = await getJob(sessionId, id);
    return reply.send(job);
  });

  // Progress endpoint - returns BullMQ job progress percentage
  app.get("/jobs/:id/progress", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const sessionId = getSessionId(request);
    const dbJob = await getJob(sessionId, id);
    let progress = 0;
    try {
      const bullJob = await getPdfQueue().getJob(id);
      if (bullJob) {
        const p = bullJob.progress;
        progress = typeof p === "number" ? p : 0;
      }
    } catch {
      // If BullMQ job not found, derive progress from status
    }
    const status = dbJob.status;
    if (status === "DONE") progress = 100;
    return reply.send({ progress, status });
  });

  app.delete("/jobs/:id", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const sessionId = getSessionId(request);
    const job = await cancelJob(sessionId, id);
    return reply.send(job);
  });

  app.get("/jobs/usage/stats", async (request, reply) => {
    const sessionId = getSessionId(request);
    const stats = await getUsageStats(sessionId);
    return reply.send(stats);
  });

  // Upload file buffer + create job (called from Next.js API route)
  app.post("/jobs/upload-and-process", jobCreationRateLimit, async (request, reply) => {
    const body = request.body as {
      files: { name: string; data: string; mimetype: string }[];
      operation: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.operation) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "operation is required" },
      });
    }

    if (!body.files || body.files.length === 0) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "At least one file is required" },
      });
    }

    const sessionId = getSessionId(request);

    const { putObject } = await import("../storage/r2");
    const fileKeys: string[] = [];

    for (const file of body.files) {
      const safeName = sanitizeFileName(file.name);
      const key = `uploads/${sessionId}/${Date.now()}-${safeName}`;
      const buffer = Buffer.from(file.data, "base64");
      await putObject(key, buffer, file.mimetype);
      fileKeys.push(key);
    }

    const typeMap: Record<string, string> = {
      merge: "MERGE",
      split: "SPLIT",
      compress: "COMPRESS",
      convert_to_png: "PDF_TO_PNG",
      convert_to_jpg: "PDF_TO_JPG",
      convert_to_txt: "PDF_TO_TXT",
      convert_to_docx: "PDF_TO_DOCX",
      convert_to_xlsx: "PDF_TO_XLSX",
      convert_to_pptx: "PDF_TO_PPTX",
      docx_to_pdf: "DOCX_TO_PDF",
      xlsx_to_pdf: "XLSX_TO_PDF",
      pptx_to_pdf: "PPTX_TO_PDF",
      html_to_pdf: "HTML_TO_PDF",
      img_to_pdf: "IMG_TO_PDF",
      add_text: "ADD_TEXT",
      watermark: "WATERMARK",
      rotate: "ROTATE",
      reorder: "REORDER",
      page_numbers: "PAGE_NUMBERS",
      encrypt: "ENCRYPT",
      flatten: "FLATTEN",
      redact: "REDACT",
      sign: "SIGN",
      ocr: "OCR",
      edit_text: "EDIT_TEXT",
      manage_pages: "MANAGE_PAGES",
    };

    const jobType = typeMap[body.operation] || body.operation.toUpperCase();

    const job = await createJob(sessionId, {
      type: jobType as any,
      metadata: { fileKeys, ...(body.metadata || {}) },
    });

    return reply.status(201).send(job);
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

    const sessionId = getSessionId(request);
    const key = `uploads/${sessionId}/${Date.now()}-${safeName}`;

    // Validate the constructed key
    validateStorageKey(key);

    const url = await getUploadUrl(key, contentType);
    return reply.send({ uploadUrl: url, key });
  });

  // Presigned download URL
  app.get("/jobs/:id/download", async (request, reply) => {
    const { id } = jobIdParamSchema.parse(request.params);
    const sessionId = getSessionId(request);
    const job = await getJob(sessionId, id);
    if (!job.outputUrl) {
      return reply.status(404).send({
        error: { code: "NOT_READY", message: "Job output not yet available" },
      });
    }

    // Validate the storage key before generating a URL
    validateStorageKey(job.outputUrl);

    const url = await getDownloadUrl(job.outputUrl);

    // If local storage, serve the file directly
    if (url.startsWith("local://")) {
      const { getObjectBuffer: getBuffer } = await import("../storage/r2");
      const buffer = await getBuffer(job.outputUrl);
      return reply
        .header("Content-Disposition", `attachment; filename="result-${id}"`)
        .header("Content-Type", "application/octet-stream")
        .send(buffer);
    }

    return reply.send({ downloadUrl: url, expiresIn: 3600 });
  });
}
