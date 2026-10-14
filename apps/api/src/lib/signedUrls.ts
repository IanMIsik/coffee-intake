import crypto from "node:crypto";
import { env } from "../env";

function signature(key: string, expires: number): string {
  return crypto
    .createHmac("sha256", `${env.jwtSecret}:files`)
    .update(`${key}:${expires}`)
    .digest("hex");
}

export function signFileUrl(key: string, ttlSeconds: number): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${env.publicBaseUrl}/files/${encodedKey}?exp=${expires}&sig=${signature(key, expires)}`;
}

export function verifyFileSignature(key: string, expires: unknown, sig: unknown): boolean {
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  if (typeof sig !== "string") return false;
  const expected = signature(key, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
