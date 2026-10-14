import { createApp } from "./app";
import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./lib/logger";

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Coffee API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  // Plain console line too, so it's visible when the JSON logger is piped elsewhere.
  console.log(`Coffee API listening on http://localhost:${env.port}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Don't hang forever on stuck connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
