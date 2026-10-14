import crypto from "node:crypto";

/** Constant-time string comparison, so a secret can't be guessed one character at a time. */
export function safeEqual(a: unknown, b: string): boolean {
  if (typeof a !== "string") return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
