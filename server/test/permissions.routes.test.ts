import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { permissionCatalog } from "../src/db/seed/permissions";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/permissions", () => {
  let server: Server;
  let baseUrl: string;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    readOnlyA = await createTenantWithUser([]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await readOnlyA.cleanup();
  });

  it("returns the full permission catalog to any authenticated user, regardless of rbac.permissions.view or any other grant", async () => {
    const res = await fetch(`${baseUrl}/api/permissions`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; key: string; module: string; description: string }> };
    expect(body.data).toHaveLength(permissionCatalog.length);
    expect(body.data.map((p) => p.key)).toEqual(expect.arrayContaining(permissionCatalog.map((p) => p.key)));
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/permissions`);
    expect(res.status).toBe(401);
  });
});
