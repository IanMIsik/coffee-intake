import { ApiError } from "@coffee/shared";
import { api } from "../lib/api";
import { listOutbox, markError, markRetryLater, markSynced, type PendingReceipt } from "../db/outbox";

/**
 * A 4xx answer means the server understood the receipt and refused it (e.g. a duplicate
 * receipt number), so retrying can never help. Anything else (no signal, 5xx, rate limit,
 * expired session) may succeed later and stays in the automatic queue.
 */
function isPermanentRejection(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}

function guessMimeType(uri: string): string {
  const ext = uri.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

async function syncOne(item: PendingReceipt): Promise<void> {
  await api.createReceipt({
    farmerId: item.farmerId,
    receiptNumber: item.receiptNumber ?? undefined,
    weightKg: item.weightKg,
    clientId: item.clientId,
    // The outbox's createdAt is when the clerk actually captured the receipt on-device,
    // which is the correct "day" for reporting even if sync happens later.
    deliveredAt: item.createdAt,
    photo: item.photoUri
      ? { uri: item.photoUri, name: `${item.clientId}.jpg`, type: guessMimeType(item.photoUri) }
      : undefined,
  });
  markSynced(item.clientId);
}

/**
 * Walks the local outbox and pushes each pending receipt to the server one at a time.
 * Safe to call repeatedly/concurrently-ish: each item is idempotent server-side via
 * its clientId, and a failure on one item doesn't block the rest of the queue.
 */
export async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  const items = listOutbox();
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await syncOne(item);
      synced += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Sync failed";
      if (isPermanentRejection(err)) markError(item.clientId, message);
      else markRetryLater(item.clientId, message);
    }
  }
  return { synced, failed };
}
