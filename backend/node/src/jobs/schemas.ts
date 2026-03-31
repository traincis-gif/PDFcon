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

export const jobTypeEnum = z.enum([
  "MERGE",
  "SPLIT",
  "COMPRESS",
  "PDF_TO_PNG",
  "PDF_TO_JPG",
  "PDF_TO_TXT",
  "PDF_TO_DOCX",
  "PDF_TO_XLSX",
  "PDF_TO_PPTX",
  "DOCX_TO_PDF",
  "XLSX_TO_PDF",
  "PPTX_TO_PDF",
  "HTML_TO_PDF",
  "IMG_TO_PDF",
  "ADD_TEXT",
  "WATERMARK",
  "ROTATE",
  "REORDER",
  "PAGE_NUMBERS",
  "ENCRYPT",
  "FLATTEN",
  "REDACT",
  "SIGN",
  "OCR",
  "EDIT_TEXT",
  "MANAGE_PAGES",
]);

const redactRegionSchema = z.object({
  page: z.number().int().min(1),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
});

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
      quality: z.enum(["low", "medium", "high"]).optional(),
      // PDF to PNG / JPG: DPI
      dpi: z.number().min(72).max(600).optional(),
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
      // Rotate: angle and optional pages
      angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).optional(),
      // Reorder: new page order (1-indexed)
      pageOrder: z.array(z.number().int().min(1)).optional(),
      // Page Numbers: position, startFrom, format
      position: z
        .enum([
          "top-left",
          "top-center",
          "top-right",
          "bottom-left",
          "bottom-center",
          "bottom-right",
        ])
        .optional(),
      startFrom: z.number().int().min(0).optional(),
      format: z
        .string()
        .trim()
        .max(100, "Format string is too long")
        .optional(),
      // Encrypt: password
      password: z
        .string()
        .trim()
        .max(256, "Password is too long")
        .optional(),
      // Redact: regions to black out
      regions: z.array(redactRegionSchema).max(500).optional(),
      // Sign: signature image and placement
      signatureImageBase64: z
        .string()
        .max(10_000_000, "Signature image is too large")
        .optional(),
      width: z.number().min(1).optional(),
      height: z.number().min(1).optional(),
      // Edit Text: inline text edits
      edits: z.array(z.object({
        page: z.number().int().min(0),
        x: z.number(),
        y: z.number(),
        width: z.number().min(0),
        height: z.number().min(0),
        originalText: z.string().max(MAX_STRING_LENGTH),
        newText: z.string().max(MAX_STRING_LENGTH),
        fontSize: z.number().min(1).max(500),
      })).max(500).optional(),
      // Manage Pages: operations array
      operations: z.array(z.object({
        type: z.enum(["delete", "rotate", "reorder", "duplicate", "addBlank", "import"]),
        pages: z.array(z.number().int()).optional(),
        angle: z.number().optional(),
        pageOrder: z.array(z.number().int()).optional(),
        sourcePage: z.number().int().optional(),
        insertAfter: z.number().int().optional(),
        insertAt: z.number().int().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        fileId: z.string().optional(),
      })).max(200).optional(),
      // OCR: language code
      language: z
        .string()
        .trim()
        .max(20, "Language code is too long")
        .optional(),
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
