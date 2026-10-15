import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { prisma } from "./db";
import { env } from "./env";
import { createLimiters } from "./lib/rateLimit";
import { logger } from "./lib/logger";
import { verifyFileSignature } from "./lib/signedUrls";
import { authRouter } from "./routes/auth";
import { batchesRouter } from "./routes/batches";
import { dashboardRouter } from "./routes/dashboard";
import { farmersRouter } from "./routes/farmers";
import { orgsRouter } from "./routes/orgs";
import { receiptsRouter } from "./routes/receipts";
import { staffRouter } from "./routes/staff";
import { UPLOADS_DIR } from "./storage/LocalDiskStorage";
import { usesS3 } from "./storage";

export function createApp(options: { rateLimit?: boolean } = {}) {
  const limiters = createLimiters(options.rateLimit ?? !env.isTest);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy || false);

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url?.startsWith("/health") ?? false } }));
  // Photos are loaded by <img> tags on the web app's origin, so they must be embeddable.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      // Empty list (development) allows any origin. Native apps send no Origin header.
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
    })
  );
  app.use(limiters.global);
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, database: "up" });
    } catch {
      res.status(503).json({ ok: false, database: "down" });
    }
  });

  // Receipt photos: only reachable through a signed, expiring link issued by the API.
  app.get("/files/*", (req, res) => {
    const key = decodeURIComponent((req.params as Record<string, string>)[0] ?? "");
    const resolved = path.resolve(UPLOADS_DIR, key);
    if (
      usesS3() ||
      !key ||
      key.includes("..") ||
      !resolved.startsWith(path.resolve(UPLOADS_DIR) + path.sep) ||
      !verifyFileSignature(key, req.query.exp, req.query.sig)
    ) {
      return res.status(403).json({ error: "This link has expired or is invalid" });
    }
    res.sendFile(resolved, { headers: { "Cache-Control": "private, max-age=300" } }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Not found" });
    });
  });

  app.use("/auth/staff/login", limiters.staffLoginByIp, limiters.staffLoginByPhone);
  app.use("/auth/staff/change-password", limiters.passwordChange);
  app.use("/auth/farmer/otp/request", limiters.otpRequestByIp, limiters.otpRequestByPhone);
  app.use("/auth/farmer/otp/verify", limiters.otpVerify);
  app.use("/orgs", limiters.provisioning);

  app.use("/auth", authRouter);
  app.use("/farmers", farmersRouter);
  app.use("/receipts", receiptsRouter);
  app.use("/batches", batchesRouter);
  app.use("/staff", staffRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/orgs", orgsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.name === "MulterError") {
      return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "That photo is too large (max 10 MB)" : err.message });
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status >= 500) {
      req.log.error({ err }, "unhandled error");
    }
    res.status(status).json({
      error:
        status >= 500 && env.isProduction
          ? "Something went wrong on our side. Please try again."
          : (err?.message ?? "Internal server error"),
    });
  });

  return app;
}
