import type { Farmer } from "@coffee/shared";
import { db } from "./database";

export function cacheFarmers(farmers: Farmer[]) {
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    for (const f of farmers) {
      db.runSync(
        `INSERT INTO cached_farmers (id, name, phone, cumulativeWeightKg, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone,
           cumulativeWeightKg=excluded.cumulativeWeightKg, updatedAt=excluded.updatedAt`,
        [f.id, f.name, f.phone, f.cumulativeWeightKg, now]
      );
    }
  });
}

export interface CachedFarmer {
  id: string;
  name: string;
  phone: string;
  cumulativeWeightKg: string;
  updatedAt: string;
}

export function searchCachedFarmers(query: string): CachedFarmer[] {
  if (!query.trim()) {
    return db.getAllSync<CachedFarmer>("SELECT * FROM cached_farmers ORDER BY name ASC LIMIT 50");
  }
  const like = `%${query}%`;
  return db.getAllSync<CachedFarmer>(
    "SELECT * FROM cached_farmers WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC LIMIT 50",
    [like, like]
  );
}
