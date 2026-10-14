import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorage, StoredFile } from "./ObjectStorage";

/** The bucket should stay private (no public access); photos are served by expiring presigned links. */
export class S3Storage implements ObjectStorage {
  private client: S3Client;

  constructor(
    private bucket: string,
    endpoint: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string
  ) {
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async save(key: string, file: StoredFile): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
      })
    );
    return key;
  }

  async getAccessUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}
