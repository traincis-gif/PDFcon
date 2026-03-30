import { z } from "zod";

/** Maximum length for general string inputs */
const MAX_STRING_LENGTH = 2048;

/** Maximum length for URL strings */
const MAX_URL_LENGTH = 2048;

/** Maximum number of file keys in a merge operation */
const MAX_MERGE_FILES = 50;

/**
 * Strict URL schema: must be a valid URL with https in production.
 * Trims whitespace and enforces max length.
 */
const safeUrlString = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, "URL is too long")
  .url("Invalid URL format")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Only allow http(s) protocols
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "URL must use http or https protocol" }
  );

export const jobTypeEnum = z.enum(["MERGE", "SPLIT", "COMPRESS", "PDF_TO_PNG", "ADD_TEXT", "WATERMARK"]);

export const createJobSchema = z.object({
  type: jobTypeEnum,
  inputUrl: safeUrlString.optional(),
  metadata: z
    .object({
      // Merge: list of file keys to merge
      fileKeys: z
        .array(
          z
            .string()
            .trim()
            .max(MAX_STRING_LENGTH, "File key is too long")
        )
        .max(MAX_MERGE_FILES, `Cannot merge more than ${MAX_MERGE_FILES} files`)
        .optional(),
      // Split: page ranges
      pages: z
        .string()
        .trim()
        .max(100, "Page range string is too long")
        .regex(/^[\d\s,\-]+$/, "Page range must contain only digits, commas, hyphens, and spaces")
        .optional(),
      // Compress: quality level
      quality: z.enum(["low", "medium", "high"]).optional().default("medium"),
      // PDF to PNG: DPI
      dpi: z.number().min(72).max(600).optional().default(150),
      // Add Text: text overlay options
      text: z
        .string()
        .trim()
        .max(MAX_STRING_LENGTH, "Text is too long")
        .optional(),
      page: z.number().int().min(0).optional(),
      x: z.number().min(0).optional(),
      y: z.number().min(0).optional(),
      fontSize: z.number().min(1).max(500).optional(),
      color: z
        .object({
          r: z.number().min(0).max(1),
          g: z.number().min(0).max(1),
          b: z.number().min(0).max(1),
        })
        .optional(),
      // Watermark: watermark options
      opacity: z.number().min(0).max(1).optional(),
      rotation: z.number().min(-360).max(360).optional(),
      // Callback webhook URL
      callbackUrl: safeUrlString.optional(),
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
  id: z.string().trim().uuid("Invalid job ID"),
});

export const uploadUrlSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name is too long"),
  contentType: z
    .string()
    .trim()
    .min(1, "Content type is required")
    .max(255, "Content type is too long"),
  fileSize: z
    .number()
    .positive("File size must be positive")
    .optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ListJobsInput = z.infer<typeof listJobsSchema>;
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
