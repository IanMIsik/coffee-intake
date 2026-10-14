import fs from "node:fs";
import path from "node:path";
import { signFileUrl } from "../lib/signedUrls";
import type { ObjectStorage, StoredFile } from "./ObjectStorage";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/**
 * Used when no S3 bucket is configured. Files live in apps/api/uploads and are only
 * reachable through signed, expiring /files links -- never as a public folder.
 */
export class LocalDiskStorage implements ObjectStorage {
  constructor() {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  async save(key: string, file: StoredFile): Promise<string> {
    const filePath = path.join(UPLOADS_DIR, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, file.buffer);
    return key;
  }

  async getAccessUrl(key: string, ttlSeconds: number): Promise<string> {
    return signFileUrl(key, ttlSeconds);
  }
}
