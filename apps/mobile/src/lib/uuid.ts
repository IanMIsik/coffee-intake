/**
 * Lightweight UUID v4 generator. Used only as a client-side idempotency key for
 * offline-created receipts, not for anything security-sensitive, so Math.random is fine
 * and avoids pulling in expo-crypto just for this.
 */
export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
