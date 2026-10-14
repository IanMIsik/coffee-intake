export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface ObjectStorage {
  /** Saves the file and returns its storage key (not a URL). */
  save(key: string, file: StoredFile): Promise<string>;
  /** A link that works for a limited time; photos are never publicly browsable. */
  getAccessUrl(key: string, ttlSeconds: number): Promise<string>;
}
