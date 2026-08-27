import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export interface StorageBackend {
  upload(buffer: Buffer, contentType: string, keyPrefix: string): Promise<{ key: string; url: string }>;
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

function extensionFor(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? "bin";
}

function buildKey(keyPrefix: string, contentType: string): string {
  return `${keyPrefix}/${randomUUID()}.${extensionFor(contentType)}`;
}

export const LOCAL_STATIC_URL_PREFIX = "/uploads";

export const localStorageRootDir = path.resolve(env.STORAGE_LOCAL_DIR);

/**
 * Dev/test/CI default — zero cloud dependency. Files are served back out via the `/uploads`
 * static route mounted in `app.ts`. With no `PUBLIC_BASE_URL` configured (the dev/test/CI
 * case — the app can listen on any port, e.g. an ephemeral port under test), returns a
 * path-only URL (`/uploads/...`) rather than guessing an origin; callers already on the
 * same origin (or behind a proxy) can use it directly. Set `PUBLIC_BASE_URL` in production
 * to get a fully-qualified URL back, matching what `S3StorageBackend` always returns.
 */
export class LocalDiskStorageBackend implements StorageBackend {
  private readonly rootDir: string;
  private readonly baseUrl: string;

  constructor(rootDir: string = localStorageRootDir, baseUrl: string = env.PUBLIC_BASE_URL ?? "") {
    this.rootDir = rootDir;
    this.baseUrl = baseUrl;
  }

  async upload(buffer: Buffer, contentType: string, keyPrefix: string): Promise<{ key: string; url: string }> {
    const key = buildKey(keyPrefix, contentType);
    const filePath = path.join(this.rootDir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return { key, url: `${this.baseUrl}${LOCAL_STATIC_URL_PREFIX}/${key}` };
  }
}

/** Behind the same interface as `LocalDiskStorageBackend`; selected automatically by `createStorageBackend` once real AWS credentials are provisioned. */
export class S3StorageBackend implements StorageBackend {
  private readonly bucket: string;
  private readonly region: string;
  private readonly client: Pick<S3Client, "send">;

  constructor(bucket: string, region: string, client: Pick<S3Client, "send"> = new S3Client({ region })) {
    this.bucket = bucket;
    this.region = region;
    this.client = client;
  }

  async upload(buffer: Buffer, contentType: string, keyPrefix: string): Promise<{ key: string; url: string }> {
    const key = buildKey(keyPrefix, contentType);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
    return { key, url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}` };
  }
}

function hasS3Config(): boolean {
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION && env.AWS_S3_BUCKET);
}

export function createStorageBackend(): StorageBackend {
  if (hasS3Config()) {
    return new S3StorageBackend(env.AWS_S3_BUCKET as string, env.AWS_REGION as string);
  }
  return new LocalDiskStorageBackend();
}

export const storageBackend = createStorageBackend();
