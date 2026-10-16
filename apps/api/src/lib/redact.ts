import type { NextFunction, Request, Response } from "express";

// Money is an admin matter: prices, amounts owed and paid, and payment status never leave the server for a
// clerk's session, so hiding them in the app is cosmetic only and cannot be bypassed.
// Payment status goes too: a clerk records deliveries and sees kilos delivered, nothing about settlement.
const MONEY_KEYS = new Set([
  "pricePerKg",
  "amount",
  "amountOwed",
  "amountPaid",
  "unpricedKg",
  "settledKg",
  "unsettledKg",
  "settled",
  "settledAt",
  "settledByStaffId",
  "settlements",
  "batchId",
]);

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
