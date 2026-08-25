import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../src/db/index";
import { rolePermissions, roles, tenants, userRoles, users } from "../../src/db/schema/index";
import { hashPassword, issueToken } from "../../src/services/auth.service";

/**
 * None of `feature_products`/`styles`/`style_options`/`super_product_components`/
 * `product_processes`/`product_measurements` carry `tenant_id` or `ON DELETE CASCADE`
 * (see `0001_enable_row_level_security.sql`'s comment on why), so a test tenant's rows
 * across the whole catalog have to be torn down in dependency order before the tenant
 * row itself can be deleted.
 */
async function cleanupCatalogForTenant(tenantId: string): Promise<void> {
  await db.execute(
    sql`delete from fitting_values where product_fitting_id in (select id from product_fittings where tenant_id = ${tenantId}) or measurement_definition_id in (select id from measurement_definitions where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from product_fittings where tenant_id = ${tenantId}`);
  await db.execute(sql`delete from style_options where style_id in (select id from styles where feature_id in (select id from features where tenant_id = ${tenantId}))`);
  await db.execute(sql`delete from styles where feature_id in (select id from features where tenant_id = ${tenantId})`);
  await db.execute(
    sql`delete from feature_products where feature_id in (select id from features where tenant_id = ${tenantId}) or product_id in (select id from products where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from features where tenant_id = ${tenantId}`);
  await db.execute(
    sql`delete from product_measurements where product_id in (select id from products where tenant_id = ${tenantId}) or measurement_definition_id in (select id from measurement_definitions where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from measurement_definitions where tenant_id = ${tenantId}`);
  await db.execute(
    sql`delete from product_processes where product_id in (select id from products where tenant_id = ${tenantId}) or process_id in (select id from processes where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from processes where tenant_id = ${tenantId}`);
  await db.execute(
    sql`delete from super_product_components where super_product_id in (select id from super_products where tenant_id = ${tenantId}) or product_id in (select id from products where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from super_products where tenant_id = ${tenantId}`);
  await db.execute(sql`delete from products where tenant_id = ${tenantId}`);
}

/**
 * Shared fixture builder for the catalog route integration tests: a fresh tenant plus a
 * user whose role holds exactly the given permissions (an empty list for "authenticated
 * but can't write anything"). Callers get back the tenant id and a bearer token, and are
 * responsible for cleaning up whatever catalog rows they create against that tenant.
 */
export async function createTenantWithUser(permissionKeys: string[] = []) {
  const suffix = randomUUID();

  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Catalog Test Tenant ${suffix}`, slug: `catalog-test-${suffix}` })
    .returning();
  if (!tenant) throw new Error("Failed to create test tenant");

  const [role] = await db.insert(roles).values({ tenantId: tenant.id, name: `Catalog-${suffix}` }).returning();
  if (!role) throw new Error("Failed to create test role");

  if (permissionKeys.length > 0) {
    const permissionRows = await db.query.permissions.findMany({
      where: (p, { inArray }) => inArray(p.key, permissionKeys),
    });
    if (permissionRows.length !== permissionKeys.length) {
      throw new Error(`Expected all of [${permissionKeys.join(", ")}] to be seeded permissions`);
    }
    for (const permission of permissionRows) {
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
    }
  }

  const passwordHash = await hashPassword("irrelevant-for-this-test");
  const [user] = await db
    .insert(users)
    .values({ tenantId: tenant.id, name: "Catalog Test User", username: `catalog-${suffix}`, passwordHash })
    .returning();
  if (!user) throw new Error("Failed to create test user");
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id });

  const token = issueToken({ sub: user.id, tenantId: tenant.id, actorType: "user" });

  return {
    tenantId: tenant.id,
    userId: user.id,
    roleId: role.id,
    token,
    async cleanup() {
      await cleanupCatalogForTenant(tenant.id);
      await db.delete(userRoles).where(eq(userRoles.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
      await db.delete(tenants).where(eq(tenants.id, tenant.id));
    },
  };
}
