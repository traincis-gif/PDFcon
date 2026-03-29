import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";
import { startWorker, closeQueue } from "./worker/queue";
import { disconnectPrisma } from "./lib/prisma";

async function main() {
  console.log("Starting PDFlow server...");
  const app = await buildApp();
  console.log("App built successfully");

  // Start the BullMQ worker in the same process (can be split for scale)
  try {
    startWorker(3);
    logger.info("BullMQ worker started");
  } catch (err) {
    logger.warn({ err }, "Failed to start BullMQ worker (Redis may be unavailable)");
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal");

    try {
      await app.close();
      logger.info("Fastify server closed");
    } catch (err) {
      logger.error({ err }, "Error closing Fastify server");
    }

    try {
      await closeQueue();
      logger.info("Queue connections closed");
    } catch (err) {
      logger.error({ err }, "Error closing queue");
    }

    try {
      await disconnectPrisma();
      logger.info("Prisma disconnected");
    } catch (err) {
      logger.error({ err }, "Error disconnecting Prisma");
    }

    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection");
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });

  // Start server
  try {
    const port = Number(process.env.PORT) || config.PORT || 8080;
    const address = await app.listen({
      port,
      host: "0.0.0.0",
    });
    console.log(`Server listening on ${address} (port ${port})`);
    logger.info({ address, port, env: config.NODE_ENV }, "Server started");
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
