import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers } from "../src/db/schema/index";
import { withTenant } from "../src/db/withTenant";
import { upsertCustomerMeasurementProfileValues } from "../src/services/measurementProfiles.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Ctx {
  token: string;
  tenantId: string;
}

/** No cascading deletes on retailer-owned rows (Phase 1 convention), so tear down bottom-up before the tenant itself. */
async function cleanupRetailerScopedRowsForTenant(tenantId: string): Promise<void> {
  await db.execute(
    sql`delete from customer_measurement_profile_values where profile_id in (select id from customer_measurement_profiles where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from customer_measurement_profiles where tenant_id = ${tenantId}`);
  await db.execute(sql`delete from customers where retailer_id in (select id from retailers where tenant_id = ${tenantId})`);
  await db.execute(sql`delete from retailers where tenant_id = ${tenantId}`);
}

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Profile Test Retailer ${suffix}`, code: `PT${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

async function postJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function createProduct(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/products", ctx.token, { name: `${name} ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createCustomer(baseUrl: string, ctx: Ctx, retailerId: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/customers", ctx.token, { retailerId, firstName: `Customer ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createMeasurementDefinition(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const suffix = randomUUID();
  const res = await postJson(baseUrl, "/api/measurement-definitions", ctx.token, {
    name: `${name} ${suffix}`,
    slug: `${name.toLowerCase()}-${suffix}`,
  });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

describe("/api/customers/:customerId/measurement-profiles/:productId", () => {
  let server: Server;
  let baseUrl: string;

  let ownerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let ownerB: Awaited<ReturnType<typeof createTenantWithUser>>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [ownerA, ownerB] = await Promise.all([
      createTenantWithUser(["customers.manage", "catalog.products.manage", "catalog.measurements.manage"]),
      createTenantWithUser(["customers.manage", "catalog.products.manage", "catalog.measurements.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupRetailerScopedRowsForTenant(ownerA.tenantId);
    await cleanupRetailerScopedRowsForTenant(ownerB.tenantId);
    await ownerA.cleanup();
    await ownerB.cleanup();
  });

  it("round-trips: writing profile values via the internal upsert makes them visible on GET", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Jacket");
    const chestId = await createMeasurementDefinition(baseUrl, ownerA, "Chest");
    const waistId = await createMeasurementDefinition(baseUrl, ownerA, "Waist");

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [
        { measurementDefinitionId: chestId, value: "40.00", adjustmentValue: "0.50" },
        { measurementDefinitionId: waistId, value: "34.00" },
      ])
    );

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as {
      data: { customerId: string; productId: string; values: Array<{ measurementDefinitionId: string; value: string; totalValue: string }> } | null;
    };
    expect(body.data).not.toBeNull();
    expect(body.data?.customerId).toBe(customerId);
    expect(body.data?.productId).toBe(productId);
    expect(body.data?.values).toHaveLength(2);

    const chest = body.data?.values.find((v) => v.measurementDefinitionId === chestId);
    const waist = body.data?.values.find((v) => v.measurementDefinitionId === waistId);
    expect(chest?.value).toBe("40.00");
    expect(chest?.totalValue).toBe("40.50");
    expect(waist?.value).toBe("34.00");
  });

  it("returns null (not a 404) for a brand-new customer+product pairing with no profile yet", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Vest");

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });

  it("per-row upserts only the submitted measurement, leaving untouched ones exactly as they were", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Pant");
    const [a, b, c] = await Promise.all([
      createMeasurementDefinition(baseUrl, ownerA, "A"),
      createMeasurementDefinition(baseUrl, ownerA, "B"),
      createMeasurementDefinition(baseUrl, ownerA, "C"),
    ]);

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [
        { measurementDefinitionId: a!, value: "10.00" },
        { measurementDefinitionId: b!, value: "20.00" },
        { measurementDefinitionId: c!, value: "30.00" },
      ])
    );

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [{ measurementDefinitionId: a!, value: "11.00" }])
    );

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    const body = (await getRes.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(body.data.values).toHaveLength(3);

    const valueFor = (id: string) => body.data.values.find((v) => v.measurementDefinitionId === id)?.value;
    expect(valueFor(a!)).toBe("11.00");
    expect(valueFor(b!)).toBe("20.00");
    expect(valueFor(c!)).toBe("30.00");
  });

  it("returns the pre-overwrite old value from the upsert call itself, per measurement", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Shirt");
    const defId = await createMeasurementDefinition(baseUrl, ownerA, "Neck");

    const firstOld = await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [{ measurementDefinitionId: defId, value: "15.00" }])
    );
    expect(firstOld.get(defId)).toBeNull();

    const secondOld = await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [{ measurementDefinitionId: defId, value: "16.00" }])
    );
    expect(secondOld.get(defId)).toBe("15.00");
  });

  it("is tenant-isolated: a session from tenant B gets 404 for tenant A's customer id", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Overcoat");

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerB.token}` },
    });
    expect(getRes.status).toBe(404);
  });

  it("is customer-isolated: a different customer's lookup for the same product never sees the other customer's profile", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerX = await createCustomer(baseUrl, ownerA, retailer.id);
    const customerY = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Trouser");
    const defId = await createMeasurementDefinition(baseUrl, ownerA, "Inseam");

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerX, productId, [{ measurementDefinitionId: defId, value: "32.00" }])
    );

    const getResX = await fetch(`${baseUrl}/api/customers/${customerX}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    const bodyX = (await getResX.json()) as { data: { values: unknown[] } | null };
    expect(bodyX.data?.values).toHaveLength(1);

    const getResY = await fetch(`${baseUrl}/api/customers/${customerY}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    const bodyY = (await getResY.json()) as { data: unknown };
    expect(bodyY.data).toBeNull();
  });
});
