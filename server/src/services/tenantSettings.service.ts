import { eq } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import { tenants } from "../db/schema/index";
import { HttpError } from "../utils/http-error";

export interface UpdateTenantSettingsInput {
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
}

/**
 * The invoice letterhead a tenant configures once — logo/address/footer text
 * `invoicePdf.service.ts` reads for both the single-order and grouped-retailer-invoice PDFs.
 * See `tenants` schema's own doc comment for why this is tenant data rather than legacy's
 * hardcoded-per-template company info: this rewrite is multi-tenant, legacy never was.
 */
export function getTenantSettings(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND", `Tenant ${tenantId} not found`);
    return tenant;
  });
}

export function updateTenantSettings(tenantId: string, input: UpdateTenantSettingsInput) {
  const isRealUpdate = input.logo !== undefined || input.address !== undefined || input.invoiceFooterText !== undefined;

  return withTenant(tenantId, async (tx) => {
    const [updated] = await tx
      .update(tenants)
      .set({
        ...(input.logo !== undefined ? { logo: input.logo || null } : {}),
        ...(input.address !== undefined ? { address: input.address || null } : {}),
        ...(input.invoiceFooterText !== undefined ? { invoiceFooterText: input.invoiceFooterText || null } : {}),
        // Phase 11 D3: any real letterhead update also satisfies first-login onboarding
        // completion — monotonic, never un-completes a profile, and a no-op call (nothing
        // to set) leaves the flag untouched rather than spuriously flipping it.
        ...(isRealUpdate ? { profileCompleted: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    if (!updated) throw new HttpError(404, "TENANT_NOT_FOUND", `Tenant ${tenantId} not found`);
    return updated;
  });
}
