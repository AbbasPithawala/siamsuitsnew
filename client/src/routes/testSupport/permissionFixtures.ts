// @ts-nocheck -- Node-only DB fixture helper for live routing tests. This
// project's browser-scoped tsconfig (src/**, DOM lib only, types: ["vite/client"],
// no @types/node) can't type-check `node:fs`/`node:crypto`/`postgres` imports.
// Runtime behavior is unaffected: Vite/Vitest strip types and execute this as
// plain JS regardless; only the `tsc -b` checker is skipped for this file.
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// bcryptjs hash of "RoutingTest123!" (SALT_ROUNDS=10), precomputed offline with
// the same algorithm server/src/services/auth.service.ts's hashPassword uses,
// so this file doesn't need bcryptjs as a client dependency just to log in as
// its own fixture users through the real POST /api/auth/login endpoint.
const FIXTURE_PASSWORD = "RoutingTest123!";
const FIXTURE_PASSWORD_HASH = "$2a$10$GZWuBlXeuPYUHLF5TFzhXOUKa0wIjFvjXcvZrbJ1quIwuwOd8ymvS";

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
 * Direct-DB fixture for a test user holding exactly `permissionKeys`,
 * mirroring `server/test/helpers/catalog-test-auth.ts`'s pattern: there's no
 * roles-management UI/API yet to create a limited-permission user through
 * the product itself. The connection reuses `siam/server`'s own
 * DATABASE_URL, which authenticates as a Postgres superuser and so bypasses
 * RLS entirely (see `server/src/db/withTenant.ts`'s doc comment) — same
 * assumption that helper relies on.
 *
 * Returns real login credentials: tests still exercise the actual
 * `POST /api/auth/login` flow through the UI form. Only fixture setup
 * bypasses the (nonexistent) admin UI for creating roles/users.
 */
export async function createTenantWithLimitedUser(permissionKeys) {
  const sql = postgres(loadServerDatabaseUrl());
  const suffix = randomUUID();
  const tenantSlug = `routing-test-${suffix}`;
  const username = `routing-${suffix}`;

  try {
    const [tenant] = await sql`
      insert into tenants (name, slug) values (${`Routing Test Tenant ${suffix}`}, ${tenantSlug})
      returning id
    `;
    const [role] = await sql`
      insert into roles (tenant_id, name) values (${tenant.id}, ${`Routing-${suffix}`})
      returning id
    `;
    if (permissionKeys.length > 0) {
      const permissionRows = await sql`select id from permissions where key in ${sql(permissionKeys)}`;
      if (permissionRows.length !== permissionKeys.length) {
        throw new Error(`Expected all of [${permissionKeys.join(", ")}] to be seeded permissions`);
      }
      for (const permission of permissionRows) {
        await sql`insert into role_permissions (role_id, permission_id) values (${role.id}, ${permission.id})`;
      }
    }
    const [user] = await sql`
      insert into users (tenant_id, name, username, password_hash)
      values (${tenant.id}, ${"Routing Test User"}, ${username}, ${FIXTURE_PASSWORD_HASH})
      returning id
    `;
    await sql`insert into user_roles (user_id, role_id) values (${user.id}, ${role.id})`;

    return {
      tenant: tenantSlug,
      username,
      password: FIXTURE_PASSWORD,
      async cleanup() {
        await sql`delete from user_roles where user_id = ${user.id}`;
        await sql`delete from users where id = ${user.id}`;
        await sql`delete from role_permissions where role_id = ${role.id}`;
        await sql`delete from roles where id = ${role.id}`;
        await sql`delete from tenants where id = ${tenant.id}`;
        await sql.end();
      },
    };
  } catch (err) {
    await sql.end();
    throw err;
  }
}

/**
 * Sibling to `createTenantWithLimitedUser`, for the (real, recurring) case
 * where a test needs a limited-permission session that can still see/act on
 * data created by an existing tenant's own admin session — e.g. placing an
 * order against a retailer/customer/super-product `admin` just created in
 * `siam-suits`. `createTenantWithLimitedUser`'s brand-new tenant can't do
 * this: every table this codebase touches is tenant-scoped (`withTenant`),
 * so a token minted for a fresh, unrelated tenant would 404/422 the moment
 * it referenced another tenant's row by id. This instead creates the role +
 * user *inside* the given tenant (looked up by slug, not created), and its
 * `cleanup()` correspondingly leaves that tenant itself alone — only the
 * role/user/permission-grant rows this function created are torn down.
 */
export async function createLimitedUserInTenant(tenantSlug, permissionKeys) {
  const sql = postgres(loadServerDatabaseUrl());
  const suffix = randomUUID();
  const username = `fixture-${suffix}`;

  try {
    const [tenant] = await sql`select id from tenants where slug = ${tenantSlug}`;
    if (!tenant) {
      throw new Error(`Expected a seeded tenant with slug "${tenantSlug}"`);
    }
    const [role] = await sql`
      insert into roles (tenant_id, name) values (${tenant.id}, ${`Fixture-${suffix}`})
      returning id
    `;
    if (permissionKeys.length > 0) {
      const permissionRows = await sql`select id from permissions where key in ${sql(permissionKeys)}`;
      if (permissionRows.length !== permissionKeys.length) {
        throw new Error(`Expected all of [${permissionKeys.join(", ")}] to be seeded permissions`);
      }
      for (const permission of permissionRows) {
        await sql`insert into role_permissions (role_id, permission_id) values (${role.id}, ${permission.id})`;
      }
    }
    const [user] = await sql`
      insert into users (tenant_id, name, username, password_hash)
      values (${tenant.id}, ${"Fixture Limited User"}, ${username}, ${FIXTURE_PASSWORD_HASH})
      returning id
    `;
    await sql`insert into user_roles (user_id, role_id) values (${user.id}, ${role.id})`;

    return {
      tenant: tenantSlug,
      username,
      password: FIXTURE_PASSWORD,
      async cleanup() {
        await sql`delete from user_roles where user_id = ${user.id}`;
        await sql`delete from users where id = ${user.id}`;
        await sql`delete from role_permissions where role_id = ${role.id}`;
        await sql`delete from roles where id = ${role.id}`;
        await sql.end();
      },
    };
  } catch (err) {
    await sql.end();
    throw err;
  }
}

/**
 * Sibling to `createLimitedUserInTenant`, additionally linking the fixture user to a real
 * `retailerId` via `retailer_users` — for tests exercising identity-based (not just
 * permission-based) behavior, e.g. `me.retailerId`-gated UI or a retailer's self-edit
 * allowance on its own retailer (`retailers.routes.ts`'s `assertCanUpdateRetailer`).
 */
export async function createRetailerLinkedUserInTenant(tenantSlug, retailerId, permissionKeys) {
  const sql = postgres(loadServerDatabaseUrl());
  const suffix = randomUUID();
  const username = `retailer-fixture-${suffix}`;

  try {
    const [tenant] = await sql`select id from tenants where slug = ${tenantSlug}`;
    if (!tenant) {
      throw new Error(`Expected a seeded tenant with slug "${tenantSlug}"`);
    }
    const [role] = await sql`
      insert into roles (tenant_id, name) values (${tenant.id}, ${`RetailerFixture-${suffix}`})
      returning id
    `;
    if (permissionKeys.length > 0) {
      const permissionRows = await sql`select id from permissions where key in ${sql(permissionKeys)}`;
      if (permissionRows.length !== permissionKeys.length) {
        throw new Error(`Expected all of [${permissionKeys.join(", ")}] to be seeded permissions`);
      }
      for (const permission of permissionRows) {
        await sql`insert into role_permissions (role_id, permission_id) values (${role.id}, ${permission.id})`;
      }
    }
    const [user] = await sql`
      insert into users (tenant_id, name, username, password_hash)
      values (${tenant.id}, ${"Retailer Fixture User"}, ${username}, ${FIXTURE_PASSWORD_HASH})
      returning id
    `;
    await sql`insert into user_roles (user_id, role_id) values (${user.id}, ${role.id})`;
    await sql`insert into retailer_users (user_id, retailer_id) values (${user.id}, ${retailerId})`;

    return {
      tenant: tenantSlug,
      username,
      password: FIXTURE_PASSWORD,
      async cleanup() {
        await sql`delete from retailer_users where user_id = ${user.id}`;
        await sql`delete from user_roles where user_id = ${user.id}`;
        await sql`delete from users where id = ${user.id}`;
        await sql`delete from role_permissions where role_id = ${role.id}`;
        await sql`delete from roles where id = ${role.id}`;
        await sql.end();
      },
    };
  } catch (err) {
    await sql.end();
    throw err;
  }
}

export async function isDatabaseReachable() {
  let sql;
  try {
    sql = postgres(loadServerDatabaseUrl());
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    if (sql) await sql.end();
  }
}
