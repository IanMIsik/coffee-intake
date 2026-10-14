import { env } from "../env";
import { LocalDiskStorage } from "./LocalDiskStorage";
import { S3Storage } from "./S3Storage";
import type { ObjectStorage } from "./ObjectStorage";

export function usesS3(): boolean {
  return Boolean(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey);
}

let cached: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  if (!cached) {
    cached = usesS3()
      ? new S3Storage(
          env.s3.bucket,
          env.s3.endpoint,
          env.s3.region,
          env.s3.accessKeyId,
          env.s3.secretAccessKey
        )
      : new LocalDiskStorage();
  }
  return cached;
}

export type { ObjectStorage };
