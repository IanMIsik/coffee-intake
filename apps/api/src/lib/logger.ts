import pino from "pino";
import { env } from "../env";

export const logger = pino({
  level: env.isTest ? "silent" : (process.env.LOG_LEVEL ?? "info"),
  // Never write credentials into the logs.
  redact: ["req.headers.authorization", "req.headers.cookie", "req.headers.apikey"],
});
