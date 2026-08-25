import { eq } from "drizzle-orm";
import { db } from "../index";
import { tenants } from "../schema/index";
import { closeLegacyDb } from "./legacy-mongo";
import { migrateRetailers } from "./retailers";
import { migrateTailors } from "./tailors";
import { migrateCustomers } from "./customers";
import { migrateOrderGroups, migrateOrders } from "./orders";
import { migrateManufacturingJobs } from "./manufacturing";
import { migrateExtraPaymentCategories, migrateExtraPayments } from "./extra-payments";
import { migrateWorkerAdvancePayments, migrateSettlements } from "./payroll";
import { migrateRetailerInvoices } from "./invoicing";
import { migrateShippingBoxes } from "./shipping";
import { summarizeDomain } from "./result";
import type { EtlDomainResult } from "./result";

/**
 * PHASE_7_TASKS.md Group 0 — one-shot(-but-safe-to-re-run) production data migration:
 * everything Phase 2's catalog-only ETL deliberately left in legacy Mongo (retailers,
 * tailors, customers, orders/group orders, manufacturing state, payroll, extra payments,
 * invoices, shipping) into the new Postgres schema, attached to the same "Siam Suits"
 * tenant Phase 2 used.
 *
 * Read-only against legacy Mongo (`legacy-mongo.ts` — never calls insert/update/delete
 * there), writes only to Postgres via `withTenant` (real tenant-scoped inserts, never a
 * superuser bypass). Every domain function is independently idempotent — re-running this
 * script is safe.
 *
 * `mongodb` is a regular (not dev) dependency: unlike Phase 2's now-deleted `catalog.ts`,
 * this isn't removed after one run — Group 0's tests import these modules directly for the
 * "safe to re-run" and per-domain deep-trace assertions, and the script itself is meant to
 * stay available for a delta-sync re-run closer to cutover (see CUTOVER_RUNBOOK.md's plan).
 */
async function run(): Promise<void> {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
  if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run `npm run db:seed` first");
  const tenantId = tenant.id;

  console.log(`Running production ETL against tenant "${tenant.name}" (${tenantId})\n`);

  const results: EtlDomainResult[] = [];

  console.log("== Retailers ==");
  results.push(await migrateRetailers(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Tailors (+ process certifications) ==");
  results.push(await migrateTailors(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Customers ==");
  results.push(await migrateCustomers(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Order groups ==");
  results.push(await migrateOrderGroups(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Orders (+ items/components/measurements/features/manufacturing steps) ==");
  results.push(await migrateOrders(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Manufacturing jobs (-> manufacturing_steps status + jobs) ==");
  results.push(await migrateManufacturingJobs(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Extra payment categories ==");
  results.push(await migrateExtraPaymentCategories(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Extra payments ==");
  results.push(await migrateExtraPayments(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Worker advance payments ==");
  results.push(await migrateWorkerAdvancePayments(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Payment settlements ==");
  results.push(await migrateSettlements(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Retailer invoices ==");
  results.push(await migrateRetailerInvoices(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Shipping boxes ==");
  results.push(await migrateShippingBoxes(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n===== Summary =====");
  let totalFound = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  for (const r of results) {
    totalFound += r.found;
    totalMigrated += r.migrated;
    totalSkipped += r.skipped.length;
    console.log(`${r.domain}: ${r.migrated}/${r.found} migrated, ${r.skipped.length} skipped`);
  }
  console.log(`\nTOTAL: ${totalMigrated}/${totalFound} migrated, ${totalSkipped} skipped`);
}

run()
  .catch((err) => {
    console.error("Production ETL failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeLegacyDb();
    process.exit(process.exitCode ?? 0);
  });
