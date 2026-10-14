import type { Request, RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { normalizePhone } from "@coffee/shared";

const MINUTE = 60 * 1000;

function phoneOf(req: Request): string {
  const raw = (req.body as { phone?: unknown } | undefined)?.phone;
  return typeof raw === "string" ? normalizePhone(raw.trim()) : "unknown";
}

function limiter(opts: {
  windowMs: number;
  limit: number;
  message: string;
  key?: (req: Request) => string;
}): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: opts.key ?? ((req) => ipKeyGenerator(req.ip ?? "")),
    handler: (_req, res) => {
      res.status(429).json({ error: opts.message });
    },
  });
}

const passthrough: RequestHandler = (_req, _res, next) => next();

export interface Limiters {
  global: RequestHandler;
  staffLoginByIp: RequestHandler;
  staffLoginByPhone: RequestHandler;
  otpRequestByPhone: RequestHandler;
  otpRequestByIp: RequestHandler;
  otpVerify: RequestHandler;
  passwordChange: RequestHandler;
  provisioning: RequestHandler;
}

/**
 * In-memory counters, which is right for one API instance. Running several instances
 * would need a shared store (e.g. Redis) so the limits are counted across all of them.
 */
export function createLimiters(enabled: boolean): Limiters {
  if (!enabled) {
    return {
      global: passthrough,
      staffLoginByIp: passthrough,
      staffLoginByPhone: passthrough,
      otpRequestByPhone: passthrough,
      otpRequestByIp: passthrough,
      otpVerify: passthrough,
      passwordChange: passthrough,
      provisioning: passthrough,
    };
  }
  return {
    global: limiter({ windowMs: MINUTE, limit: 600, message: "Too many requests. Please slow down." }),
    staffLoginByIp: limiter({
      windowMs: 15 * MINUTE,
      limit: 30,
      message: "Too many sign-in attempts. Try again in 15 minutes.",
    }),
    staffLoginByPhone: limiter({
      windowMs: 15 * MINUTE,
      limit: 8,
      message: "Too many sign-in attempts for this account. Try again in 15 minutes.",
      key: (req) => `${ipKeyGenerator(req.ip ?? "")}:${phoneOf(req)}`,
    }),
    // Per phone number: stops someone using the app to flood a victim with texts.
    otpRequestByPhone: limiter({
      windowMs: 60 * MINUTE,
      limit: 4,
      message: "Too many login codes requested for this number. Try again in an hour.",
      key: phoneOf,
    }),
    otpRequestByIp: limiter({
      windowMs: 60 * MINUTE,
      limit: 20,
      message: "Too many login codes requested. Try again later.",
    }),
    otpVerify: limiter({
      windowMs: 15 * MINUTE,
      limit: 40,
      message: "Too many attempts. Try again in 15 minutes.",
    }),
    passwordChange: limiter({
      windowMs: 60 * MINUTE,
      limit: 10,
      message: "Too many password change attempts. Try again later.",
    }),
    provisioning: limiter({
      windowMs: 60 * MINUTE,
      limit: 10,
      message: "Too many attempts.",
    }),
  };
}
