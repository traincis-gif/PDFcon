import crypto from "crypto";
import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { config } from "./config";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/errors";
import { jobsRouter } from "./jobs/router";
import { getQueueStats } from "./worker/queue";
import { registerSecurityHooks } from "./middleware/security";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
    // 75MB body limit to account for base64 encoding overhead (~33%) on 50MB files.
    // A 50MB file becomes ~67MB when base64-encoded inside JSON.
    bodyLimit: 75 * 1024 * 1024,
  });

  // --- Plugins ---

  // Cookie support for session management
  await app.register(cookie);

  // CORS: strict origins in production, permissive in development
  const isProduction = config.NODE_ENV === "production";
  if (isProduction && config.CORS_ORIGINS === "*") {
    logger.warn("CORS_ORIGINS is set to wildcard '*' in production. This is insecure. Set explicit origins.");
  }
  await app.register(cors, {
    origin: isProduction
      ? config.CORS_ORIGINS === "*"
        ? false // Deny all if wildcard in production (fail-safe)
        : config.CORS_ORIGINS.split(",").map((o) => o.trim())
      : config.CORS_ORIGINS === "*"
        ? true
        : config.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Helmet with proper CSP
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.ip;
    },
  });

  // --- Security hooks (sanitization, request ID header) ---
  registerSecurityHooks(app);

  // --- Session cookie management ---
  app.addHook("preHandler", (request, reply, done) => {
    const existing = request.cookies["pdflow-session"];
    if (!existing) {
      const sessionId = crypto.randomUUID();
      reply.setCookie("pdflow-session", sessionId, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
        sameSite: "lax",
      });
    }
    done();
  });

  // --- Request logging ---
  app.addHook("onRequest", (request, reply, done) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        requestId: request.id,
        ip: request.ip,
      },
      "Incoming request"
    );
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        requestId: request.id,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
    done();
  });

  // --- Error handler ---
  app.setErrorHandler(errorHandler);

  // --- Health check ---
  app.get("/health", async (request, reply) => {
    let queueStats = null;
    try {
      queueStats = await getQueueStats();
    } catch {
      // Queue might not be connected
    }

    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: config.NODE_ENV,
      uptime: process.uptime(),
      queue: queueStats,
    });
  });

  // --- Routes ---
  await app.register(jobsRouter);

  // --- 404 handler ---
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return app;
}
