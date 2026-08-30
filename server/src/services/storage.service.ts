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

/**
 * `LocalDiskStorageBackend.upload` returns a path-only URL (`/uploads/<key>`) whenever
 * `PUBLIC_BASE_URL` isn't set (dev/test/CI — see its own doc comment). The client resolves
 * that the same way (`resolveUploadUrl` in `client/src/features/uploads/uploadsApi.ts`) by
 * prefixing the browser's own known origin — but `orderPdf.service.ts` renders images
 * server-side, inside HTML handed to Puppeteer via `page.setContent`, which has no origin
 * (`about:blank`) to resolve a relative path against at all. A bare `/uploads/...` path
 * there doesn't fail loudly — it just silently doesn't load, which is exactly what made a
 * real Manual Size / reference / customer image "just not show up" in a generated PDF.
 * Only rewrites paths under this server's own real upload prefix (`LOCAL_STATIC_URL_PREFIX`,
 * `/uploads`) — deliberately narrower than "any leading `/`": catalog-seeded style/style-
 * option images (e.g. `/ImagesFabric/...`) are relative to the *client's* static assets, a
 * different origin this function has no way to know, and a bare filename (e.g. a legacy-
 * migrated retailer logo hosted elsewhere) is a different, unrelated convention too — both
 * are left untouched rather than guessed at.
 */
export function resolveServerImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith(`${LOCAL_STATIC_URL_PREFIX}/`)) return url;
  const base = env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
  return `${base}${url}`;
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
