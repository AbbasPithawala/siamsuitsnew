import { and, eq, isNull } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { retailers } from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import type { EtlDomainResult } from "./result";

/** `siamServer/admin/model/model.retailer.js` */
interface LegacyRetailer {
  _id: unknown;
  retailer_name: string;
  username: string;
  retailer_code: string;
  owner_name?: string;
  retailer_logo?: string;
  email_recipients?: string;
  status?: boolean;
}

/**
 * Idempotency: `retailers.code` is unique per `(tenantId, code)` — the real natural key,
 * same as `retailers.service.ts#createRetailer` relies on. No mapping file needed.
 */
export async function migrateRetailers(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyRetailers = await db.collection<LegacyRetailer>("retailers").find({}).toArray();

  const result: EtlDomainResult = { domain: "retailers", found: legacyRetailers.length, migrated: 0, skipped: [] };

  for (const legacy of legacyRetailers) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const code = legacy.retailer_code?.trim();
    if (!code) {
      result.skipped.push({ legacyId, reason: "missing retailer_code — cannot form the required unique (tenant, code) key" });
      continue;
    }

    await withTenant(tenantId, async (tx) => {
      const existing = await tx.query.retailers.findFirst({
        where: and(eq(retailers.tenantId, tenantId), eq(retailers.code, code)),
      });
      if (existing) return;

      await tx.insert(retailers).values({
        tenantId,
        name: legacy.retailer_name?.trim() || code,
        code,
        ownerName: legacy.owner_name?.trim() || null,
        logo: legacy.retailer_logo?.trim() || null,
        emailRecipients: legacy.email_recipients ? legacy.email_recipients.split(",").map((s) => s.trim()).filter(Boolean) : null,
        isActive: legacy.status ?? true,
      });
    });
    result.migrated++;
  }

  return result;
}

export async function requireMigratedRetailerId(tenantId: string, code: string): Promise<string> {
  return withTenant(tenantId, async (tx) => {
    const retailer = await tx.query.retailers.findFirst({
      where: and(eq(retailers.tenantId, tenantId), eq(retailers.code, code), isNull(retailers.deletedAt)),
    });
    if (!retailer) throw new Error(`ETL: retailer with code "${code}" was not migrated — run migrateRetailers first`);
    return retailer.id;
  });
}
