import { eq } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { customers } from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import { loadState, saveState } from "./state";
import { requireMigratedRetailerId } from "./retailers";
import type { EtlDomainResult } from "./result";

/** `siamServer/retailer/model/model.customerMeasurement.js` (Mongoose model name is `Customer`, collection `customers`). */
interface LegacyCustomer {
  _id: unknown;
  firstname?: string;
  lastname?: string;
  gender?: string;
  phone?: unknown;
  retailer_code?: string;
  image?: string;
}

/**
 * Idempotency: `customers` has no natural key on either side (see `state.ts`'s comment), so
 * this is the one domain tracked in the untracked JSON map file — `legacyId -> new customer
 * UUID`. Everything downstream that needs a customer (orders) resolves through this map.
 */
export async function migrateCustomers(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyCustomers = await db.collection<LegacyCustomer>("customers").find({}).toArray();

  const result: EtlDomainResult = { domain: "customers", found: legacyCustomers.length, migrated: 0, skipped: [] };
  const state = loadState();

  for (const legacy of legacyCustomers) {
    const legacyId = idToString(legacy._id);
    if (!legacyId) {
      result.skipped.push({ legacyId: "(no _id)", reason: "document has no _id" });
      continue;
    }

    const cachedId = state.customers[legacyId];
    if (cachedId) {
      // Trust, but verify: the state file can outlive the rows it points at (e.g. a
      // truncate-and-rerun during testing/recovery that didn't also clear this file) — a
      // stale id would otherwise surface much later as a confusing FK violation when an
      // order tries to reference it. Self-heal by re-migrating instead.
      const stillExists = await withTenant(tenantId, (tx) => tx.query.customers.findFirst({ where: eq(customers.id, cachedId) }));
      if (stillExists) {
        result.migrated++;
        continue;
      }
      delete state.customers[legacyId];
    }

    const code = legacy.retailer_code?.trim();
    if (!code) {
      result.skipped.push({ legacyId, reason: "missing retailer_code — customer can't be attached to a retailer" });
      continue;
    }

    let retailerId: string;
    try {
      retailerId = await requireMigratedRetailerId(tenantId, code);
    } catch {
      result.skipped.push({ legacyId, reason: `references retailer_code "${code}" which was not migrated (orphaned/unknown retailer)` });
      continue;
    }

    const firstName = legacy.firstname?.trim() || legacy.lastname?.trim() || "(unnamed)";

    const newId = await withTenant(tenantId, async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          tenantId,
          retailerId,
          firstName,
          lastName: legacy.lastname?.trim() || null,
          gender: legacy.gender?.trim() || null,
          contactNumber: legacy.phone !== undefined && legacy.phone !== null ? String(legacy.phone) : null,
          image: legacy.image?.trim() || null,
        })
        .returning();
      if (!customer) throw new Error(`ETL: failed to create customer for legacy id ${legacyId}`);
      return customer.id;
    });

    state.customers[legacyId] = newId;
    result.migrated++;
  }

  saveState(state);
  return result;
}

export function resolveMigratedCustomerId(legacyCustomerId: string): string | null {
  const state = loadState();
  return state.customers[legacyCustomerId] ?? null;
}

export async function requireMigratedCustomer(tenantId: string, legacyCustomerId: string) {
  const id = resolveMigratedCustomerId(legacyCustomerId);
  if (!id) throw new Error(`ETL: customer ${legacyCustomerId} was not migrated — run migrateCustomers first`);
  return withTenant(tenantId, (tx) => tx.query.customers.findFirst({ where: eq(customers.id, id) }));
}
