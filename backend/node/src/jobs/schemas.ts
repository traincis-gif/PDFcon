import { z } from "zod";

export const jobTypeEnum = z.enum(["MERGE", "SPLIT", "COMPRESS", "PDF_TO_PNG"]);

export const createJobSchema = z.object({
  type: jobTypeEnum,
  inputUrl: z.string().url().optional(),
  metadata: z
    .object({
      // Merge: list of file keys to merge
      fileKeys: z.array(z.string()).optional(),
      // Split: page ranges
      pages: z.string().optional(), // e.g., "1-3,5,7-10"
      // Compress: quality level
      quality: z.enum(["low", "medium", "high"]).optional().default("medium"),
      // PDF to PNG: DPI
      dpi: z.number().min(72).max(600).optional().default(150),
      // Callback webhook URL
      callbackUrl: z.string().url().optional(),
    })
    .optional()
    .default({}),
});

export const listJobsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]).optional(),
  type: jobTypeEnum.optional(),
});

export const jobIdParamSchema = z.object({
  id: z.string().uuid("Invalid job ID"),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ListJobsInput = z.infer<typeof listJobsSchema>;
