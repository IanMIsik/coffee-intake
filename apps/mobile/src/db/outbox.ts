import { db } from "./database";

export interface PendingReceipt {
  clientId: string;
  farmerId: string;
  farmerName: string;
  // null = let the server auto-generate one (e.g. DF-000123) when it syncs.
  receiptNumber: string | null;
  weightKg: number;
  photoUri: string | null;
  createdAt: string;
  status: "pending" | "synced" | "error";
  lastError: string | null;
}

export function enqueueReceipt(input: {
  clientId: string;
  farmerId: string;
  farmerName: string;
  receiptNumber: string | null;
  weightKg: number;
  photoUri: string | null;
}) {
  db.runSync(
    `INSERT INTO pending_receipts (clientId, farmerId, farmerName, receiptNumber, weightKg, photoUri, createdAt, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      input.clientId,
      input.farmerId,
      input.farmerName,
      input.receiptNumber,
      input.weightKg,
      input.photoUri,
      new Date().toISOString(),
    ]
  );
}

/** What the automatic sync should try: only items that may still succeed. */
export function listOutbox(): PendingReceipt[] {
  return db.getAllSync<PendingReceipt>(
    "SELECT * FROM pending_receipts WHERE status = 'pending' ORDER BY createdAt ASC"
  );
}

/** Everything not yet on the server, including items the server rejected. */
export function listUnsynced(): PendingReceipt[] {
  return db.getAllSync<PendingReceipt>(
    "SELECT * FROM pending_receipts WHERE status != 'synced' ORDER BY createdAt ASC"
  );
}

/** A temporary failure (no signal, server busy): stays queued and is retried automatically. */
export function markRetryLater(clientId: string, message: string) {
  db.runSync("UPDATE pending_receipts SET lastError = ? WHERE clientId = ?", [message, clientId]);
}

/** Puts a rejected item back in the queue so the next sync tries it again. */
export function requeue(clientId: string) {
  db.runSync("UPDATE pending_receipts SET status = 'pending', lastError = NULL WHERE clientId = ?", [clientId]);
}

export function discard(clientId: string) {
  db.runSync("DELETE FROM pending_receipts WHERE clientId = ?", [clientId]);
}

export function failedCount(): number {
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_receipts WHERE status = 'error'"
  );
  return row?.count ?? 0;
}

export function markSynced(clientId: string) {
  db.runSync("UPDATE pending_receipts SET status = 'synced', lastError = NULL WHERE clientId = ?", [
    clientId,
  ]);
}

export function markError(clientId: string, message: string) {
  db.runSync("UPDATE pending_receipts SET status = 'error', lastError = ? WHERE clientId = ?", [
    message,
    clientId,
  ]);
}

export function pendingCount(): number {
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_receipts WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}
