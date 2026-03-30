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

    const { putObject } = await import("../storage/r2");
    const fileKeys: string[] = [];

    for (const file of body.files) {
      const safeName = sanitizeFileName(file.name);
      const key = `uploads/${ANONYMOUS_USER_ID}/${Date.now()}-${safeName}`;
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
    };

    const jobType = typeMap[body.operation] || body.operation.toUpperCase();

    const job = await createJob(ANONYMOUS_USER_ID, {
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
