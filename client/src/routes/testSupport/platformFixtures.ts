// @ts-nocheck -- Node-only DB cleanup helper for live platform-admin/onboarding tests. See
// permissionFixtures.ts's identical top-of-file note: this project's browser-scoped tsconfig
// can't type-check node:fs/postgres imports; Vite/Vitest still execute this as plain JS.
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadServerDatabaseUrl() {
  const envPath = path.resolve(process.cwd(), "../server/.env");
  const contents = readFileSync(envPath, "utf-8");
  const match = contents.match(/^DATABASE_URL=(.+)$/m);
  if (!match) {
    throw new Error(`DATABASE_URL not found in ${envPath}`);
  }
  return match[1].trim();
}

/**
 * Tears down everything a real `POST /tenant-requests/:id/approve` call creates for a given
 * slug (PHASE_11_TASKS.md Workstream F/G live tests) — the Owner role, its permission grants,
 * the owner user, the `userRoles` link, and the tenant row itself — plus any `tenant_requests`
 * row for that same slug (pending, approved, or rejected). Keeps repeated live-test runs from
 * accumulating tenants in the real dev DB, which matters here specifically because
 * `TenantsPage`'s live test has to find one exact row among however many tenants exist.
 *
 * Assumes (as every test in `onboarding.live.test.tsx` does) that the approve dialog was never
 * given a `slug` override — the tenant's real slug always equals the original `requestedSlug`.
 */
export async function cleanupProvisionedTenant(slug) {
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const [tenant] = await sql`select id from tenants where slug = ${slug}`;
    if (tenant) {
      await sql`update tenant_requests set created_tenant_id = null where created_tenant_id = ${tenant.id}`;
      const users = await sql`select id from users where tenant_id = ${tenant.id}`;
      for (const user of users) {
        await sql`delete from user_roles where user_id = ${user.id}`;
      }
      await sql`delete from users where tenant_id = ${tenant.id}`;
      const roles = await sql`select id from roles where tenant_id = ${tenant.id}`;
      for (const role of roles) {
        await sql`delete from role_permissions where role_id = ${role.id}`;
      }
      await sql`delete from roles where tenant_id = ${tenant.id}`;
      await sql`delete from tenants where id = ${tenant.id}`;
    }
    await sql`delete from tenant_requests where requested_slug = ${slug}`;
  } finally {
    await sql.end();
  }
}
