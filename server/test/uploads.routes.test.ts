import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers, retailerUsers, users } from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { localStorageRootDir } from "../src/services/storage.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("POST /api/uploads", () => {
  let server: Server;
  let baseUrl: string;
  let withCreate: Awaited<ReturnType<typeof createTenantWithUser>>;
  let withEdit: Awaited<ReturnType<typeof createTenantWithUser>>;
  let withoutCreate: Awaited<ReturnType<typeof createTenantWithUser>>;
  const uploadedKeys: string[] = [];

  let retailerLinkedUserId: string;
  let retailerId: string;
  let retailerLinkedToken: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // PHASE_10_TASKS.md Workstream E Group 6: this endpoint is gated on `orders.create`
    // OR `orders.edit` — `orders.create` covers order creation (StylingAccordion's
    // reference-image upload, held by the seeded Retailer role); `orders.edit` covers
    // order editing (ManualSizeEditor's annotation upload, held by the seeded Owner role,
    // which lost `orders.create` per Group 5).
    [withCreate, withEdit, withoutCreate] = await Promise.all([
      createTenantWithUser(["orders.create"]),
      createTenantWithUser(["orders.edit"]),
      createTenantWithUser([]),
    ]);

    // `RetailerProfilePage.tsx`'s logo upload: a retailer-linked user holding NEITHER
    // permission must still be allowed through, purely on identity (`assertCanUpload`'s
    // doc comment) — reuses `withoutCreate`'s tenant so the only variable is the retailer link.
    const suffix = randomUUID();
    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId: withoutCreate.tenantId, name: `Upload Test Retailer ${suffix}`, code: `UTR-${suffix.slice(0, 6)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [retailerLinkedUser] = await db
      .insert(users)
      .values({ tenantId: withoutCreate.tenantId, name: "Upload Test Retailer User", username: `upload-retailer-${suffix}`, passwordHash })
      .returning();
    if (!retailerLinkedUser) throw new Error("Failed to create test retailer-linked user");
    retailerLinkedUserId = retailerLinkedUser.id;
    await db.insert(retailerUsers).values({ retailerId, userId: retailerLinkedUserId });
    retailerLinkedToken = issueToken({ sub: retailerLinkedUserId, tenantId: withoutCreate.tenantId, actorType: "user" });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all(uploadedKeys.map((key) => rm(path.join(localStorageRootDir, key), { force: true })));
    await db.delete(retailerUsers).where(eq(retailerUsers.retailerId, retailerId));
    await db.delete(users).where(eq(users.id, retailerLinkedUserId));
    await db.delete(retailers).where(eq(retailers.id, retailerId));
    await Promise.all([withCreate.cleanup(), withEdit.cleanup(), withoutCreate.cleanup()]);
  });

  function pngFormData(sizeBytes = 128): FormData {
    const form = new FormData();
    const buffer = new Uint8Array(sizeBytes).fill(1);
    form.append("file", new Blob([buffer], { type: "image/png" }), "test.png");
    return form;
  }

  it("401s with no auth token", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: pngFormData() });
    expect(res.status).toBe(401);
  });

  it("403s a token that lacks both orders.create and orders.edit", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${withoutCreate.token}` },
      body: pngFormData(),
    });
    expect(res.status).toBe(403);
  });

  it("accepts a token holding only orders.edit (not orders.create) — the Owner-role edit path", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${withEdit.token}` },
      body: pngFormData(),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { key: string; url: string } };
    uploadedKeys.push(body.data.key);
  });

  it("accepts a retailer-linked user holding neither orders.create nor orders.edit — RetailerProfilePage.tsx's logo upload", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${retailerLinkedToken}` },
      body: pngFormData(),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { key: string; url: string } };
    uploadedKeys.push(body.data.key);
  });

  it("415s a non-image content type", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "text/plain" }), "test.txt");

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${withCreate.token}` },
      body: form,
    });
    expect(res.status).toBe(415);
  });

  it("400s when no file field is sent", async () => {
    const form = new FormData();
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${withCreate.token}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it("413s a file over the size limit", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${withCreate.token}` },
      body: pngFormData(11 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it(
    "uploads a real image with no AWS config present, lands on local disk, and is fetchable back byte-identical " +
      "— the realistic dev/CI path this endpoint must support with zero cloud credentials",
    async () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;

      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "image/png" }), "reference.png");

      const res = await fetch(`${baseUrl}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${withCreate.token}` },
        body: form,
      });
      expect(res.status).toBe(201);

      const body = (await res.json()) as { data: { key: string; url: string } };
      expect(body.data.key).toMatch(/^generic\/[0-9a-f-]+\.png$/);
      uploadedKeys.push(body.data.key);

      // No PUBLIC_BASE_URL configured in this environment (the realistic dev/CI case), so
      // the local-disk backend returns a path-only URL — resolve it against this test's own
      // ephemeral server address rather than assuming any fixed origin.
      const fetchUrl = body.data.url.startsWith("http") ? body.data.url : `${baseUrl}${body.data.url}`;
      const fetched = await fetch(fetchUrl);
      expect(fetched.status).toBe(200);
      const fetchedBuffer = Buffer.from(await fetched.arrayBuffer());
      expect(fetchedBuffer.equals(Buffer.from(bytes))).toBe(true);
    }
  );
});
