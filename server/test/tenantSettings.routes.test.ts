import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { tenants } from "../src/db/schema/index";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

/**
 * PHASE_10_TASKS.md invoicing follow-up — the tenant's invoice letterhead
 * (logo/address/footer text), read by `invoicePdf.service.ts` for both PDF templates.
 * Legacy hardcoded this company info because it only ever served one company; this
 * rewrite is multi-tenant, so it's a real settings resource instead.
 */

async function getJson(baseUrl: string, path: string, token: string) {
  return fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function patchJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe("/api/invoice-settings", () => {
  let server: Server;
  let baseUrl: string;

  let manager: Awaited<ReturnType<typeof createTenantWithUser>>;
  let viewer: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noAccess: Awaited<ReturnType<typeof createTenantWithUser>>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [manager, viewer, noAccess] = await Promise.all([
      createTenantWithUser(["invoices.manage", "invoices.view"]),
      createTenantWithUser(["invoices.view"]),
      createTenantWithUser([]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([manager.cleanup(), viewer.cleanup(), noAccess.cleanup()]);
  });

  it("updates and re-reads the letterhead fields", async () => {
    const patchRes = await patchJson(baseUrl, "/api/invoice-settings", manager.token, {
      address: "1022/87 Charoen Nakorn 34/2, Bangkok",
      invoiceFooterText: "Thank You For Shopping At Siam Suits Supply",
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { data: { address: string; invoiceFooterText: string } };
    expect(patched.data.address).toBe("1022/87 Charoen Nakorn 34/2, Bangkok");
    expect(patched.data.invoiceFooterText).toBe("Thank You For Shopping At Siam Suits Supply");

    const getRes = await getJson(baseUrl, "/api/invoice-settings", manager.token);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { data: { address: string; invoiceFooterText: string } };
    expect(fetched.data.address).toBe("1022/87 Charoen Nakorn 34/2, Bangkok");

    const reloaded = await db.query.tenants.findFirst({ where: eq(tenants.id, manager.tenantId) });
    expect(reloaded?.address).toBe("1022/87 Charoen Nakorn 34/2, Bangkok");
  });

  it("allows an invoices.view-only holder to read but not update", async () => {
    const getRes = await getJson(baseUrl, "/api/invoice-settings", viewer.token);
    expect(getRes.status).toBe(200);

    const patchRes = await patchJson(baseUrl, "/api/invoice-settings", viewer.token, { address: "Should not be allowed" });
    expect(patchRes.status).toBe(403);
  });

  it("403s a user with neither invoices.view nor invoices.manage", async () => {
    const getRes = await getJson(baseUrl, "/api/invoice-settings", noAccess.token);
    expect(getRes.status).toBe(403);
  });

  it("is tenant-scoped: updating one tenant's settings never touches another's", async () => {
    await patchJson(baseUrl, "/api/invoice-settings", manager.token, { address: "Manager's address" });

    const otherRes = await getJson(baseUrl, "/api/invoice-settings", viewer.token);
    const otherBody = (await otherRes.json()) as { data: { address: string | null } };
    expect(otherBody.data.address).not.toBe("Manager's address");
  });
});
