import { env } from "../env";
import { getObjectStorage } from "../storage";

const PHOTO_LINK_TTL_SECONDS = 60 * 60;

/**
 * Receipts created before photos became private store a full public URL instead of a
 * storage key. Recover the key from either form; anything else is left untouched.
 */
export function extractPhotoKey(stored: string): string | null {
  if (!/^https?:\/\//i.test(stored)) return stored;
  const marker = "/uploads/";
  const i = stored.indexOf(marker);
  if (i >= 0) return decodeURIComponent(stored.slice(i + marker.length));
  const base = env.s3.publicBaseUrl.replace(/\/+$/, "");
  if (base && stored.startsWith(`${base}/`)) return decodeURIComponent(stored.slice(base.length + 1));
  return null;
}

export async function photoAccessUrl(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  const key = extractPhotoKey(stored);
  if (!key) return stored;
  return getObjectStorage().getAccessUrl(key, PHOTO_LINK_TTL_SECONDS);
}

/** Replaces the stored photo reference on a receipt with a short-lived link. */
export async function presentReceipt<T extends { photoUrl: string | null }>(receipt: T): Promise<T> {
  return { ...receipt, photoUrl: await photoAccessUrl(receipt.photoUrl) };
}

export function presentReceipts<T extends { photoUrl: string | null }>(receipts: T[]): Promise<T[]> {
  return Promise.all(receipts.map(presentReceipt));
}
