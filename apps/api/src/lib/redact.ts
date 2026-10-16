import type { NextFunction, Request, Response } from "express";

// Money is an admin matter: prices, amounts owed and amounts paid never leave the server for a
// clerk's session, so hiding them in the app is cosmetic only and cannot be bypassed.
const MONEY_KEYS = new Set(["pricePerKg", "amount", "amountOwed", "amountPaid", "unpricedKg"]);

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!MONEY_KEYS.has(k)) out[k] = strip(v);
    }
    return out;
  }
  return value;
}

/** Removes every money field from JSON responses when the caller is a clerk. */
export function hideMoneyFromClerks(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.kind === "staff" && req.auth.role !== "ADMIN") {
    const original = res.json.bind(res);
    res.json = (body?: unknown) => original(strip(JSON.parse(JSON.stringify(body ?? null))));
  }
  next();
}
