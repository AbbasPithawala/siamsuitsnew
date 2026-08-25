import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/db/index";
import { withTenant } from "../src/db/withTenant";
import { products, tenants } from "../src/db/schema/index";

/**
 * Real proof that Postgres RLS (not application code) is what keeps tenants apart.
 * Two tenants get a `products` row with the identical name, then every read below goes
 * through `tx.select().from(products)` with no `WHERE tenant_id = ...` at all — if
 * isolation holds, it's the database enforcing it, not a query filter a service author
 * could forget. See the `enable_row_level_security` migration and `withTenant.ts`.
 */
describe("RLS tenant isolation via withTenant", () => {
  const suffix = randomUUID();
  let tenantA: { id: string };
  let tenantB: { id: string };
  let productA: { id: string };
  let productB: { id: string };

  beforeAll(async () => {
    [tenantA] = await db
      .insert(tenants)
      .values({ name: `RLS Test Tenant A ${suffix}`, slug: `rls-test-a-${suffix}` })
      .returning({ id: tenants.id });
    [tenantB] = await db
      .insert(tenants)
      .values({ name: `RLS Test Tenant B ${suffix}`, slug: `rls-test-b-${suffix}` })
      .returning({ id: tenants.id });

    [productA] = await db
      .insert(products)
      .values({ tenantId: tenantA.id, name: "Classic Navy Jacket" })
      .returning({ id: products.id });
    [productB] = await db
      .insert(products)
      .values({ tenantId: tenantB.id, name: "Classic Navy Jacket" })
      .returning({ id: products.id });
  });

  afterAll(async () => {
    await db.delete(products).where(inArray(products.id, [productA.id, productB.id]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA.id, tenantB.id]));
  });

  it("returns only tenant A's row when scoped to tenant A, with no WHERE tenant_id in the query", async () => {
    const rows = await withTenant(tenantA.id, (tx) => tx.select().from(products));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(productA.id);
    expect(ids).not.toContain(productB.id);
  });

  it("returns only tenant B's row when scoped to tenant B, with no WHERE tenant_id in the query", async () => {
    const rows = await withTenant(tenantB.id, (tx) => tx.select().from(products));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(productB.id);
    expect(ids).not.toContain(productA.id);
  });

  it("rejects an insert whose tenant_id doesn't match the scoped tenant (WITH CHECK, not just USING)", async () => {
    await expect(
      withTenant(tenantA.id, (tx) =>
        tx.insert(products).values({ tenantId: tenantB.id, name: `Cross-tenant insert attempt ${suffix}` })
      )
    ).rejects.toThrow();
  });

  it("documents the bare-db (no withTenant) behavior: the pooled connection is a Postgres superuser and unconditionally bypasses RLS, so it sees both tenants' rows", async () => {
    const rows = await db.select().from(products).where(inArray(products.id, [productA.id, productB.id]));
    expect(rows.map((r) => r.id).sort()).toEqual([productA.id, productB.id].sort());
  });
});
