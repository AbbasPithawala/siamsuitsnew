import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers, retailerInvoices, roles, rolePermissions, userRoles, users } from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

/** Adds another user (with its own role/permission set) to an *existing* tenant, so permission-gated read tests can share the same tenant/invoice fixtures instead of hitting cross-tenant 404s instead of the 403s they're meant to test — same helper shape as `orders.routes.test.ts`'s. */
async function createUserInTenant(tenantId: string, permissionKeys: string[]) {
  const suffix = randomUUID();
  const [role] = await db.insert(roles).values({ tenantId, name: `Invoices-${suffix}` }).returning();
  if (!role) throw new Error("Failed to create role");

  if (permissionKeys.length > 0) {
    const permissionRows = await db.query.permissions.findMany({ where: (p, { inArray: inArrayOp }) => inArrayOp(p.key, permissionKeys) });
    if (permissionRows.length !== permissionKeys.length) throw new Error(`Missing seeded permissions among [${permissionKeys.join(", ")}]`);
    for (const permission of permissionRows) {
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
    }
  }

  const passwordHash = await hashPassword("irrelevant-for-this-test");
  const [user] = await db
    .insert(users)
    .values({ tenantId, name: "Invoices Test User", username: `invoices-${suffix}`, passwordHash })
    .returning();
  if (!user) throw new Error("Failed to create user");
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id });

  const token = issueToken({ sub: user.id, tenantId, actorType: "user" });
  return {
    token,
    async cleanup() {
      await db.delete(userRoles).where(eq(userRoles.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
    },
  };
}

async function postJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function patchJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function getJson(baseUrl: string, path: string, token: string) {
  return fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

describe("/api/invoices", () => {
  let server: Server;
  let baseUrl: string;

  let manager: Awaited<ReturnType<typeof createTenantWithUser>>;
  let viewer: Awaited<ReturnType<typeof createUserInTenant>>;
  let noAccess: Awaited<ReturnType<typeof createUserInTenant>>;
  let otherTenant: Awaited<ReturnType<typeof createTenantWithUser>>;

  let retailer: { id: string; code: string };

  const invoiceIds: string[] = [];

  async function createRetailer(tenantId: string) {
    const suffix = randomUUID();
    const [row] = await db
      .insert(retailers)
      .values({ tenantId, name: `Invoice Test Retailer ${suffix}`, code: `INV${suffix.slice(0, 6).toUpperCase()}` })
      .returning();
    if (!row) throw new Error("Failed to create test retailer");
    return row;
  }

  async function createInvoice(token: string, overrides: Record<string, unknown> = {}) {
    const res = await postJson(baseUrl, "/api/invoices", token, {
      retailerId: retailer.id,
      lineItems: [
        { description: "Suit - Jacket", quantity: 2, unitPrice: 150 },
        { description: "Suit - Trouser", quantity: 1, unitPrice: 75 },
      ],
      ...overrides,
    });
    const body = (await res.json()) as { data: { id: string } };
    if (res.status === 201) invoiceIds.push(body.data.id);
    return { res, body };
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [manager, otherTenant] = await Promise.all([
      createTenantWithUser(["invoices.manage", "invoices.view"]),
      createTenantWithUser(["invoices.manage", "invoices.view"]),
    ]);
    [viewer, noAccess] = await Promise.all([
      createUserInTenant(manager.tenantId, ["invoices.view"]),
      createUserInTenant(manager.tenantId, []),
    ]);

    retailer = await createRetailer(manager.tenantId);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (invoiceIds.length) {
      for (const id of invoiceIds) await db.delete(retailerInvoices).where(eq(retailerInvoices.id, id));
    }
    await db.delete(retailers).where(eq(retailers.id, retailer.id));
    // viewer/noAccess are users on manager's tenant (via createUserInTenant), so their
    // cleanup (deleting their role) must finish before manager.cleanup() deletes the tenant.
    await Promise.all([viewer.cleanup(), noAccess.cleanup()]);
    await Promise.all([manager.cleanup(), otherTenant.cleanup()]);
  });

  it("computes the total server-side from lineItems, discount, and shippingCharge — ignoring any client-submitted total", async () => {
    const { res, body } = await createInvoice(manager.token, {
      discount: 20,
      shippingCharge: 10,
      total: 999999.99, // must be ignored — not part of the accepted schema
    });
    expect(res.status).toBe(201);
    const data = body.data as unknown as {
      lineItems: Array<{ amount: string }>;
      discount: string;
      shippingCharge: string;
      total: string;
      status: string;
      invoiceNumber: string;
    };

    // subTotal = 2*150 + 1*75 = 375; total = 375 - 20 + 10 = 365.00
    expect(data.lineItems[0]?.amount).toBe("300.00");
    expect(data.lineItems[1]?.amount).toBe("75.00");
    expect(data.discount).toBe("20.00");
    expect(data.shippingCharge).toBe("10.00");
    expect(data.total).toBe("365.00");
    expect(data.status).toBe("Unpaid");
    expect(data.invoiceNumber).toBe(`${retailer.code}-INV-0001`);
  });

  it("rejects a discount that would drive the total negative", async () => {
    const { res, body } = await createInvoice(manager.token, { discount: 100000 });
    expect(res.status).toBe(422);
    expect((body as unknown as { error: { code: string } }).error.code).toBe("INVALID_TOTAL");
  });

  it("rejects an empty lineItems array with VALIDATION_ERROR", async () => {
    const res = await postJson(baseUrl, "/api/invoices", manager.token, { retailerId: retailer.id, lineItems: [] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("404s creating an invoice against a bogus retailerId", async () => {
    const res = await postJson(baseUrl, "/api/invoices", manager.token, {
      retailerId: randomUUID(),
      lineItems: [{ description: "X", quantity: 1, unitPrice: 10 }],
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RETAILER_NOT_FOUND");
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/invoices`);
    expect(res.status).toBe(401);
  });

  it("403s a create request from a user lacking invoices.manage", async () => {
    const res = await postJson(baseUrl, "/api/invoices", noAccess.token, {
      retailerId: retailer.id,
      lineItems: [{ description: "X", quantity: 1, unitPrice: 10 }],
    });
    expect(res.status).toBe(403);
  });

  it("403s a GET (list) request from a user lacking invoices.view — reads are gated more strictly than the catalog convention", async () => {
    const res = await getJson(baseUrl, "/api/invoices", noAccess.token);
    expect(res.status).toBe(403);
  });

  it("allows a read-only invoices.view holder to list and get, but not create", async () => {
    const { body: created } = await createInvoice(manager.token);

    const listRes = await getJson(baseUrl, "/api/invoices", viewer.token);
    expect(listRes.status).toBe(200);

    const getRes = await getJson(baseUrl, `/api/invoices/${created.data.id}`, viewer.token);
    expect(getRes.status).toBe(200);

    const createRes = await postJson(baseUrl, "/api/invoices", viewer.token, {
      retailerId: retailer.id,
      lineItems: [{ description: "X", quantity: 1, unitPrice: 10 }],
    });
    expect(createRes.status).toBe(403);
  });

  it("is tenant-scoped: another tenant's manager cannot see this tenant's invoice by id or in its list", async () => {
    const { body: created } = await createInvoice(manager.token);

    const getAsOther = await getJson(baseUrl, `/api/invoices/${created.data.id}`, otherTenant.token);
    expect(getAsOther.status).toBe(404);

    const listAsOther = await getJson(baseUrl, "/api/invoices", otherTenant.token);
    const listBody = (await listAsOther.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((i) => i.id)).not.toContain(created.data.id);
  });

  it("filters the list by retailerId and status", async () => {
    const { body: created } = await createInvoice(manager.token);

    const listRes = await getJson(baseUrl, `/api/invoices?retailerId=${retailer.id}&status=Unpaid`, manager.token);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((i) => i.id)).toContain(created.data.id);

    const listPaidRes = await getJson(baseUrl, `/api/invoices?retailerId=${retailer.id}&status=Paid`, manager.token);
    const listPaidBody = (await listPaidRes.json()) as { data: Array<{ id: string }> };
    expect(listPaidBody.data.map((i) => i.id)).not.toContain(created.data.id);
  });

  it("transitions an invoice to Paid, rejects re-marking it Paid, and 403s the transition for a user lacking invoices.manage", async () => {
    const { body: created } = await createInvoice(manager.token);

    const forbiddenRes = await patchJson(baseUrl, `/api/invoices/${created.data.id}/status`, viewer.token, { status: "Paid" });
    expect(forbiddenRes.status).toBe(403);

    const res = await patchJson(baseUrl, `/api/invoices/${created.data.id}/status`, manager.token, { status: "Paid" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("Paid");

    const reloaded = await db.query.retailerInvoices.findFirst({ where: eq(retailerInvoices.id, created.data.id) });
    expect(reloaded?.status).toBe("Paid");

    const repeatRes = await patchJson(baseUrl, `/api/invoices/${created.data.id}/status`, manager.token, { status: "Paid" });
    expect(repeatRes.status).toBe(409);
    const repeatBody = (await repeatRes.json()) as { error: { code: string } };
    expect(repeatBody.error.code).toBe("INVOICE_STATUS_UNCHANGED");
  });

  it("rejects an invalid status value with VALIDATION_ERROR", async () => {
    const { body: created } = await createInvoice(manager.token);
    const res = await patchJson(baseUrl, `/api/invoices/${created.data.id}/status`, manager.token, { status: "Cancelled" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("generates sequential invoice numbers per retailer as retailerCode-INV-NNNN", async () => {
    const freshRetailer = await createRetailer(manager.tenantId);

    const makeInvoice = () =>
      postJson(baseUrl, "/api/invoices", manager.token, {
        retailerId: freshRetailer.id,
        lineItems: [{ description: "Item", quantity: 1, unitPrice: 10 }],
      });

    const first = await makeInvoice();
    const firstBody = (await first.json()) as { data: { id: string; invoiceNumber: string } };
    expect(firstBody.data.invoiceNumber).toBe(`${freshRetailer.code}-INV-0001`);

    const second = await makeInvoice();
    const secondBody = (await second.json()) as { data: { id: string; invoiceNumber: string } };
    expect(secondBody.data.invoiceNumber).toBe(`${freshRetailer.code}-INV-0002`);

    // Delete this test's own invoices before the retailer they reference (FK), rather than
    // relying on the outer `afterAll` — that only tears down `invoiceIds`/`retailer` (the
    // shared fixture), not this test's own throwaway retailer.
    await db.delete(retailerInvoices).where(inArray(retailerInvoices.id, [firstBody.data.id, secondBody.data.id]));
    await db.delete(retailers).where(eq(retailers.id, freshRetailer.id));
  });
});
