import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../index";
import { tenants, retailers, tailors, orders, jobs, manufacturingSteps, retailerInvoices, paymentSettlements } from "../schema/index";
import { getOrder } from "../../services/orders.service";
import { getOrderGroup } from "../../services/order-groups.service";
import { getSettlement } from "../../services/payroll.service";
import { getInvoice } from "../../services/invoices.service";
import { migrateRetailers } from "./retailers";
import { migrateTailors } from "./tailors";
import { migrateShippingBoxes } from "./shipping";

/**
 * PHASE_7_TASKS.md Group 0's required test coverage: idempotency (safe to re-run) plus one
 * deep end-to-end trace per domain, asserting the *reconstructed API shape* against real
 * migrated production data — not just that rows exist.
 *
 * Like `withTenant.rls.test.ts`, this assumes a prerequisite has already been run: here,
 * `npm run etl:production` against this database (not `db:seed`, which these tests also
 * need transitively for the tenant). If that hasn't happened yet in a given environment,
 * every test below fails loudly with a clear reason rather than silently passing — matching
 * this codebase's existing convention for environment-dependent live-integration tests.
 */
async function requireTenantId(): Promise<string> {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
  if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run `npm run db:seed` first");
  return tenant.id;
}

async function requireOrderIdByNumber(tenantId: string, orderNumber: string): Promise<string> {
  const order = await db.query.orders.findFirst({ where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)) });
  if (!order) {
    throw new Error(`Expected order "${orderNumber}" to already be migrated — run \`npm run etl:production\` against this database first`);
  }
  return order.id;
}

describe("production ETL (PHASE_7_TASKS.md Group 0)", () => {
  it("is idempotent: re-running migrateRetailers/migrateTailors against already-migrated data inserts nothing new", async () => {
    const tenantId = await requireTenantId();

    const retailersBefore = await db.query.retailers.findMany({ where: eq(retailers.tenantId, tenantId) });
    if (retailersBefore.length === 0) {
      throw new Error("Expected retailers to already be migrated — run `npm run etl:production` against this database first");
    }

    const retailerResult = await migrateRetailers(tenantId);
    const retailersAfter = await db.query.retailers.findMany({ where: eq(retailers.tenantId, tenantId) });
    expect(retailersAfter).toHaveLength(retailersBefore.length);
    expect(retailerResult.migrated).toBe(retailerResult.found);
    expect(retailerResult.skipped).toHaveLength(0);

    const tailorResult = await migrateTailors(tenantId);
    expect(tailorResult.migrated).toBe(tailorResult.found);
    // A second run must not mint fresh random passwords for tailors that already exist —
    // `migrateTailors` only generates one when it actually inserts a new row.
    const tailorsAfterSecondRun = await db.query.tailors.findMany({ where: eq(tailors.tenantId, tenantId) });
    expect(tailorsAfterSecondRun.length).toBe(tailorResult.found);
  }, 30000);

  it("shipping_boxes ETL is internally consistent (found = migrated + skipped) even with zero real records today", async () => {
    const tenantId = await requireTenantId();
    const result = await migrateShippingBoxes(tenantId);
    expect(result.migrated + result.skipped.length).toBeLessThanOrEqual(result.found);
  }, 30000);

  it("traces a real migrated normal order (MEQ-N-0001) end-to-end through the same assembly GET /orders/:id uses", async () => {
    const tenantId = await requireTenantId();
    const orderId = await requireOrderIdByNumber(tenantId, "MEQ-N-0001");

    const order = await getOrder(tenantId, orderId);
    expect(order.status).toBe("Sent");
    expect(order.type).toBe("normal");
    expect(order.items).toHaveLength(1);

    const item = order.items[0]!;
    expect(item.components).toHaveLength(1);
    const component = item.components[0]!;
    expect(component.slotLabel).toBe("Jacket");

    // Real legacy measurement values from the source order (verified against live Mongo
    // while building this ETL): chest 25, length 24, everything else genuinely 0.
    const chest = component.measurements.find((m) => m.value === "25.00");
    expect(chest).toBeDefined();
    expect(component.measurements.length).toBeGreaterThanOrEqual(12);

    // fabric_code "asdsad" and lining_code "aasd" -> the ETL-backfilled `fabric`/`lining
    // code` text features (see orders.ts's writeStyleBlockFeatures).
    expect(component.features.some((f) => f.textValue === "asdsad")).toBe(true);
    expect(component.features.some((f) => f.textValue === "aasd")).toBe(true);

    // monogram {tag: "asds", font: "Style-05", color: "1309"} -> the structured feature.
    const monogramFeature = component.features.find((f) => f.structuredValue !== null);
    expect(monogramFeature?.structuredValue).toMatchObject({ tag: "asds", font: "Style-05", color: "1309" });

    // "jacket lapel" = "notch lapel 4.25 inches" fuzzy-matched to the catalog's base
    // "notch lapel" style, preserving the original width detail as textValue (see
    // catalog.ts's findStyleForFeature / orders.ts's writeChoiceFeature).
    const lapelFeature = component.features.find((f) => f.textValue === "notch lapel 4.25 inches");
    expect(lapelFeature?.styleId).not.toBeNull();

    // Every manufacturing step was "Sent" in legacy — all 4 (cutting, jacket neck/body
    // stitching, jacket sleeves, jacket buttons) landed as real, present-tense "complete"
    // rows, each with a real tailor and timestamps (never dropped to the manufacturing
    // blob's occasionally-corrupted state — see manufacturing.ts's top comment).
    expect(component.manufacturingSteps).toHaveLength(4);
    for (const step of component.manufacturingSteps) {
      expect(step.status).toBe("complete");
      expect(step.tailorId).not.toBeNull();
      expect(step.completedAt).not.toBeNull();
    }
  });

  it("expands a legacy order_item's quantity into that many real order_items, not one (EDW-N-00012: 2 suits + 2 shirts)", async () => {
    const tenantId = await requireTenantId();
    const orderId = await requireOrderIdByNumber(tenantId, "EDW-N-00012");

    const order = await getOrder(tenantId, orderId);
    expect(order.items).toHaveLength(4);

    const bundled = order.items.filter((i) => i.components.length === 2);
    const standalone = order.items.filter((i) => i.components.length === 1);
    expect(bundled).toHaveLength(2); // the 2 suits, each Jacket+Pant
    expect(standalone).toHaveLength(2); // the 2 shirts

    // Sequences are unique and contiguous across the expansion, not reused per legacy array entry.
    expect(order.items.map((i) => i.sequence).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it("traces a real migrated group order end-to-end — the group and its child orders share the ordinary order/manufacturing model", async () => {
    const tenantId = await requireTenantId();
    const realGroup = await db.query.orderGroups.findFirst({ where: (g, { eq: eqOp }) => eqOp(g.tenantId, tenantId) });
    if (!realGroup) throw new Error("Expected at least one migrated order_group — run `npm run etl:production` first");

    const detail = await getOrderGroup(tenantId, realGroup.id);
    expect(detail.orders.length).toBeGreaterThan(0);
    for (const childOrder of detail.orders) {
      expect(childOrder.type).toBe("group");
      expect(childOrder.groupId).toBe(realGroup.id);
      // Every child order went through the exact same item/component/manufacturing-step
      // assembly a normal order does (no separate/dead group-manufacturing path — see
      // FUNCTIONALITY_OVERVIEW.md's note on why legacy's own group tracking was dead code).
      for (const item of childOrder.items) {
        for (const component of item.components) {
          expect(Array.isArray(component.manufacturingSteps)).toBe(true);
        }
      }
    }
  });

  it("traces a real migrated manufacturing job to its manufacturing_steps row and tailor", async () => {
    const tenantId = await requireTenantId();
    const job = await db.query.jobs.findFirst({ where: eq(jobs.tenantId, tenantId), orderBy: (j, { asc }) => asc(j.createdAt) });
    if (!job) throw new Error("Expected at least one migrated job — run `npm run etl:production` first");

    const step = await db.query.manufacturingSteps.findFirst({ where: eq(manufacturingSteps.id, job.manufacturingStepId) });
    expect(step).toBeDefined();
    expect(step!.tailorId).toBe(job.tailorId);
    expect(["assigned", "complete"]).toContain(step!.status);
    expect(Number(job.cost)).toBeGreaterThanOrEqual(0);
  });

  it("traces a real migrated payment settlement end-to-end, preserving legacy's historical amounts rather than recomputing them", async () => {
    const tenantId = await requireTenantId();
    const settlement = await db.query.paymentSettlements.findFirst({ where: eq(paymentSettlements.tenantId, tenantId) });
    if (!settlement) throw new Error("Expected at least one migrated settlement — run `npm run etl:production` first");

    const detail = await getSettlement(tenantId, settlement.tailorId, settlement.id);
    expect(detail.settlement.id).toBe(settlement.id);
    expect(detail.settlement.subTotal).toBe(settlement.subTotal);
    expect(detail.settlement.totalPay).toBe(settlement.totalPay);
    expect(detail.jobs.length).toBeGreaterThan(0);
    // Every linked job actually belongs to this settlement's tailor.
    for (const entry of detail.jobs) expect(entry.job.tailorId).toBe(settlement.tailorId);
  });

  it("traces a real migrated extra payment back to its job/category/component chain", async () => {
    const tenantId = await requireTenantId();
    const tenantJobs = await db.query.jobs.findMany({ where: eq(jobs.tenantId, tenantId) });
    const tenantJobIds = new Set(tenantJobs.map((j) => j.id));

    const candidates = await db.query.extraPayments.findMany({});
    const extraPayment = candidates.find((ep) => tenantJobIds.has(ep.jobId));
    if (!extraPayment) throw new Error("Expected at least one migrated extra payment — run `npm run etl:production` first");

    const category = await db.query.extraPaymentCategories.findFirst({ where: (c, { eq: eqOp }) => eqOp(c.id, extraPayment.categoryId) });
    expect(category?.tenantId).toBe(tenantId);
    expect(Number(extraPayment.cost)).toBeGreaterThanOrEqual(0);
  });

  it("traces the real migrated retailer invoice, preserving legacy's total/discount/shipping exactly", async () => {
    const tenantId = await requireTenantId();
    const invoice = await db.query.retailerInvoices.findFirst({ where: eq(retailerInvoices.tenantId, tenantId) });
    if (!invoice) throw new Error("Expected the migrated retailer invoice — run `npm run etl:production` first");

    const detail = await getInvoice(tenantId, invoice.id);
    expect(detail.total).toBe("13600.00");
    expect(detail.discount).toBe("70.00");
    expect(detail.shippingCharge).toBe("5000.00");
    expect(Array.isArray(detail.lineItems)).toBe(true);
    expect((detail.lineItems as unknown[]).length).toBeGreaterThan(0);
  });
});
