import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function compareOtpCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export const OTP_TTL_MS = 5 * 60 * 1000;
