import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("coffee.db");

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS cached_farmers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      cumulativeWeightKg TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_receipts (
      clientId TEXT PRIMARY KEY,
      farmerId TEXT NOT NULL,
      farmerName TEXT NOT NULL,
      receiptNumber TEXT,
      weightKg REAL NOT NULL,
      photoUri TEXT,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      lastError TEXT
    );
  `);
  migrateLegacyPendingReceiptsTable();
}

/**
 * Devices that installed the app before receiptNumber became nullable still have the
 * old NOT NULL column -- CREATE TABLE IF NOT EXISTS is a no-op against an existing
 * table, so it never picks up that change on its own. SQLite has no ALTER COLUMN, so
 * rebuild the table and copy the rows across when that's detected.
 */
function migrateLegacyPendingReceiptsTable() {
  const columns = db.getAllSync<{ name: string; notnull: number }>(
    "PRAGMA table_info(pending_receipts)"
  );
  const receiptNumberCol = columns.find((c) => c.name === "receiptNumber");
  if (!receiptNumberCol || receiptNumberCol.notnull !== 1) return;

  db.execSync(`
    CREATE TABLE pending_receipts_migrated (
      clientId TEXT PRIMARY KEY,
      farmerId TEXT NOT NULL,
      farmerName TEXT NOT NULL,
      receiptNumber TEXT,
      weightKg REAL NOT NULL,
      photoUri TEXT,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      lastError TEXT
    );
    INSERT INTO pending_receipts_migrated SELECT * FROM pending_receipts;
    DROP TABLE pending_receipts;
    ALTER TABLE pending_receipts_migrated RENAME TO pending_receipts;
  `);
}
