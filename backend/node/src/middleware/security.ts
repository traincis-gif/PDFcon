import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../lib/logger";
import { AppError } from "../lib/errors";

// --- Constants ---

/** Allowed MIME types for file uploads */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

/** Allowed file extensions (derived from MIME types) */
export const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_FILE_TYPES));

/** Maximum file size for uploads: 50 MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// --- Input Sanitization ---

/**
 * Strip HTML tags from a string to prevent stored XSS.
 * Preserves the text content between tags.
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/**
 * Recursively sanitize all string values in an object by stripping HTML tags.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return stripHtmlTags(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }
  return obj;
}

// --- File Name Sanitization ---

/**
 * Sanitize a file name by removing path traversal sequences, null bytes,
 * and other dangerous characters. Returns only the basename.
 */
export function sanitizeFileName(fileName: string): string {
  let sanitized = fileName;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\.\//g, "");
  sanitized = sanitized.replace(/\.\.\\/g, "");
  sanitized = sanitized.replace(/\.\./g, "");

  // Extract only the basename (remove any directory components)
  sanitized = sanitized.split("/").pop() || "";
  sanitized = sanitized.split("\\").pop() || "";

  // Remove any remaining control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, "");

  // Collapse multiple dots/spaces
  sanitized = sanitized.replace(/\.{2,}/g, ".");
  sanitized = sanitized.replace(/\s{2,}/g, " ");

  // Trim whitespace and dots from edges
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, "").trim();

  if (!sanitized) {
    return "unnamed_file";
  }

  return sanitized;
}

// --- S3 Key Validation ---

/**
 * Validate an S3/R2 object key to prevent path traversal attacks.
 * Keys must not contain path traversal sequences or null bytes.
 */
export function validateStorageKey(key: string): void {
  if (!key || typeof key !== "string") {
    throw new AppError(400, "INVALID_KEY", "Storage key is required");
  }

  if (key.includes("\0")) {
    throw new AppError(400, "INVALID_KEY", "Storage key contains invalid characters");
  }

  if (key.includes("..")) {
    throw new AppError(400, "INVALID_KEY", "Storage key must not contain path traversal sequences");
  }

  // Must start with a known prefix
  const allowedPrefixes = ["uploads/", "outputs/", "temp/"];
  const hasValidPrefix = allowedPrefixes.some((prefix) => key.startsWith(prefix));
  if (!hasValidPrefix) {
    throw new AppError(400, "INVALID_KEY", "Storage key has an invalid prefix");
  }

  // Max key length (S3 limit is 1024, we use a tighter limit)
  if (key.length > 512) {
    throw new AppError(400, "INVALID_KEY", "Storage key is too long");
  }
}

// --- File Type Validation ---

/**
 * Validate that a content type is in the allowed list.
 */
export function validateFileType(contentType: string, fileName?: string): void {
  if (!ALLOWED_FILE_TYPES[contentType]) {
    throw new AppError(
      400,
      "INVALID_FILE_TYPE",
      `File type '${contentType}' is not allowed. Allowed types: PDF, DOCX, XLSX, PPTX, PNG, JPG`
    );
  }

  // If fileName is provided, also check extension matches
  if (fileName) {
    const ext = ("." + fileName.split(".").pop()?.toLowerCase()) || "";
    const expectedExt = ALLOWED_FILE_TYPES[contentType];
    // Allow .jpeg as alias for .jpg
    const validExts = expectedExt === ".jpg" ? [".jpg", ".jpeg"] : [expectedExt];
    if (!validExts.includes(ext)) {
      throw new AppError(
        400,
        "FILE_TYPE_MISMATCH",
        `File extension does not match content type '${contentType}'`
      );
    }
  }
}

/**
 * Validate file size against the maximum allowed.
 */
export function validateFileSize(size: number): void {
  if (size > MAX_FILE_SIZE) {
    throw new AppError(
      400,
      "FILE_TOO_LARGE",
      `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    );
  }
}

// --- Fastify Hooks ---

/**
 * Register security hooks on a Fastify instance.
 * - Sanitizes string inputs in request body
 * - Adds request ID to all responses
 */
export function registerSecurityHooks(app: FastifyInstance): void {
  // Sanitize request body strings (strip HTML tags)
  app.addHook("preHandler", (request: FastifyRequest, reply: FastifyReply, done) => {
    if (request.body && typeof request.body === "object") {
      (request as any).body = sanitizeObject(request.body);
    }
    done();
  });

  // Add request ID header to all responses for traceability
  app.addHook("onSend", (request: FastifyRequest, reply: FastifyReply, payload, done) => {
    reply.header("X-Request-Id", request.id);
    done(null, payload);
  });
}
