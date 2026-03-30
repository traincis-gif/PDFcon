import crypto from "crypto";
import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/errors";
import { jobsRouter } from "./jobs/router";
import { getQueueStats } from "./worker/queue";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // --- Plugins ---
  await app.register(cors, {
    origin: config.CORS_ORIGINS === "*" ? true : config.CORS_ORIGINS.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.ip;
    },
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
