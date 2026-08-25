import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LocalDiskStorageBackend, S3StorageBackend } from "./storage.service";

describe("LocalDiskStorageBackend", () => {
  let server: Server;
  let baseUrl: string;
  let tempDir: string;
  let backend: LocalDiskStorageBackend;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "siam-storage-test-"));

    const testApp = express();
    testApp.use("/uploads", express.static(tempDir));

    await new Promise<void>((resolve) => {
      server = testApp.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    backend = new LocalDiskStorageBackend(tempDir, baseUrl);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes a real buffer to disk and returns a key/url that fetches back byte-identical — no mocking", async () => {
    const original = Buffer.from(`real-round-trip-content-${randomUUID()}`, "utf-8");

    const result = await backend.upload(original, "image/png", "test-prefix");

    expect(result.key).toMatch(/^test-prefix\/[0-9a-f-]+\.png$/);
    expect(result.url).toBe(`${baseUrl}/uploads/${result.key}`);

    const onDisk = await readFile(path.join(tempDir, result.key));
    expect(onDisk.equals(original)).toBe(true);

    const response = await fetch(result.url);
    expect(response.status).toBe(200);
    const fetchedBuffer = Buffer.from(await response.arrayBuffer());
    expect(fetchedBuffer.equals(original)).toBe(true);
  });

  it("namespaces different keyPrefix values into different directories and never collides across uploads", async () => {
    const bufferA = Buffer.from("content-a");
    const bufferB = Buffer.from("content-b");

    const resultA = await backend.upload(bufferA, "image/jpeg", "prefix-a");
    const resultB = await backend.upload(bufferB, "image/jpeg", "prefix-b");

    expect(resultA.key).not.toBe(resultB.key);
    expect(resultA.key.startsWith("prefix-a/")).toBe(true);
    expect(resultB.key.startsWith("prefix-b/")).toBe(true);

    const fetchedA = await fetch(resultA.url);
    const fetchedB = await fetch(resultB.url);
    expect(Buffer.from(await fetchedA.arrayBuffer()).equals(bufferA)).toBe(true);
    expect(Buffer.from(await fetchedB.arrayBuffer()).equals(bufferB)).toBe(true);
  });
});

describe("S3StorageBackend", () => {
  it("uploads via the injected S3 client (never a real AWS call) and returns a virtual-hosted-style URL", async () => {
    const send = vi.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
    const fakeClient = { send };
    const backend = new S3StorageBackend("test-bucket", "ap-northeast-1", fakeClient);

    const buffer = Buffer.from("fake-image-bytes");
    const result = await backend.upload(buffer, "image/jpeg", "orders");

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Body: buffer,
      ContentType: "image/jpeg",
    });
    expect(command.input.Key).toMatch(/^orders\/[0-9a-f-]+\.jpg$/);

    expect(result.key).toBe(command.input.Key);
    expect(result.url).toBe(`https://test-bucket.s3.ap-northeast-1.amazonaws.com/${result.key}`);
  });

  it("propagates the client's rejection rather than swallowing it", async () => {
    const send = vi.fn().mockRejectedValue(new Error("simulated S3 failure"));
    const backend = new S3StorageBackend("test-bucket", "ap-northeast-1", { send });

    await expect(backend.upload(Buffer.from("x"), "image/png", "orders")).rejects.toThrow("simulated S3 failure");
  });
});
