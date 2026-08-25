import { boolean, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, softDeleteColumn, timestampColumns } from "./_shared";

export const tenants = pgTable("tenants", {
  ...idColumn,
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  plan: text("plan").notNull().default("standard"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  slugUnique: uniqueIndex("tenants_slug_unique").on(table.slug),
}));

/** Anyone who logs into the admin/staff or retailer side of the app. */
export const users = pgTable("users", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantUsernameUnique: uniqueIndex("users_tenant_username_unique").on(table.tenantId, table.username),
}));

/**
 * A retailer is a business entity, deliberately decoupled from `users` (see
 * REWRITE_ARCHITECTURE.md §2) so a retailer can have more than one staff login later —
 * something the current single Retailer-is-a-login model can't do.
 */
export const retailers = pgTable("retailers", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  ownerName: text("owner_name"),
  logo: text("logo"),
  address: text("address"),
  phone: text("phone"),
  emailRecipients: text("email_recipients").array(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantCodeUnique: uniqueIndex("retailers_tenant_code_unique").on(table.tenantId, table.code),
}));

/**
 * Join table: which users can act on behalf of which retailers. The `userId` side is
 * additionally unique — a user is pinned to at most one retailer — while the `retailerId`
 * side stays unconstrained (a retailer can have multiple staff logins), matching this
 * table's original M:N design intent (see REWRITE_ARCHITECTURE.md §2).
 */
export const retailerUsers = pgTable("retailer_users", {
  ...idColumn,
  retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  ...timestampColumns,
}, (table) => ({
  retailerUserUnique: uniqueIndex("retailer_users_unique").on(table.retailerId, table.userId),
  userUnique: uniqueIndex("retailer_users_user_id_unique").on(table.userId),
}));

/** Factory-floor workers. No self-serve app today — kept separate from `users`. */
export const tailors = pgTable("tailors", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  advanceBalance: numeric("advance_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantUsernameUnique: uniqueIndex("tailors_tenant_username_unique").on(table.tenantId, table.username),
}));

/**
 * Global permission catalog — NOT tenant-scoped. The set of possible permissions is
 * defined by the software, not by tenants. See PHASE_1_TASKS.md Group 6 for the actual
 * seeded list.
 */
export const permissions = pgTable("permissions", {
  ...idColumn,
  key: text("key").notNull(),
  module: text("module").notNull(),
  description: text("description").notNull(),
  ...timestampColumns,
}, (table) => ({
  keyUnique: uniqueIndex("permissions_key_unique").on(table.key),
}));

export const roles = pgTable("roles", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  // A tenant's seeded "Owner" role — protected from deletion and from having its
  // permissions stripped, and the tenant's last active holder of any such role can't be
  // deactivated/removed/unassigned (PHASE_8_TASKS.md Group 3). Set at seed time, not
  // matched by name — this rewrite is multi-tenant and each tenant gets its own instance.
  isSystem: boolean("is_system").notNull().default(false),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantNameUnique: uniqueIndex("roles_tenant_name_unique").on(table.tenantId, table.name),
}));

export const rolePermissions = pgTable("role_permissions", {
  ...idColumn,
  roleId: uuid("role_id").notNull().references(() => roles.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
}, (table) => ({
  rolePermissionUnique: uniqueIndex("role_permissions_unique").on(table.roleId, table.permissionId),
}));

/** A user can hold more than one role. */
export const userRoles = pgTable("user_roles", {
  ...idColumn,
  userId: uuid("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
}, (table) => ({
  userRoleUnique: uniqueIndex("user_roles_unique").on(table.userId, table.roleId),
}));
