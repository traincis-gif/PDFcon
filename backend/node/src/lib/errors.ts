import { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { logger } from "./logger";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    // Don't echo the user-supplied ID back in production to avoid information leakage
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? `${resource} not found`
        : id
          ? `${resource} with id '${id}' not found`
          : `${resource} not found`;
    super(404, "NOT_FOUND", safeMessage);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded") {
    super(429, "RATE_LIMIT_EXCEEDED", message);
  }
}

export class PlanLimitError extends AppError {
  constructor(message: string, details?: unknown) {
    super(403, "PLAN_LIMIT_EXCEEDED", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "VALIDATION_ERROR", "Request validation failed", details);
  }
}

export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  const isProduction = process.env.NODE_ENV === "production";

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }

  if (error instanceof ZodError) {
    const appErr = new ValidationError(formatZodError(error));
    return reply.status(appErr.statusCode).send(appErr.toJSON());
  }

  // Fastify validation errors
  if ("validation" in error && "validationContext" in error) {
    const appErr = new ValidationError((error as any).validation);
    return reply.status(400).send(appErr.toJSON());
  }

  // Fastify body size limit errors
  if ("statusCode" in error && (error as any).statusCode === 413) {
    return reply.status(413).send({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large",
      },
    });
  }

  // Log the full error internally — never expose to client
  logger.error(
    {
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      requestId: request.id,
      method: request.method,
      url: request.url,
    },
    "Unhandled error"
  );

  // Never send stack traces or internal error messages to the client in production
  return reply.status(500).send({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isProduction
        ? "An unexpected error occurred"
        : error.message,
      // Only include stack in non-production for debugging
      ...(isProduction ? {} : { stack: error.stack }),
    },
  });
}
