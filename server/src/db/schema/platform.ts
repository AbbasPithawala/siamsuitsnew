import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./_shared";
import { tenants } from "./tenancy";

/**
 * Global tables — no `tenant_id`, no RLS policy (see `0001_enable_row_level_security.sql`'s
 * own precedent for `permissions`, the other global table). A platform admin sits above
 * tenancy entirely; a tenant request exists before any tenant does. Deactivate a platform
 * admin via `isActive` (matches `users`/`tailors`) rather than soft-delete — no product need
 * to hard-remove the account vs. merely disabling it.
 */
export const platformAdmins = pgTable("platform_admins", {
  ...idColumn,
  name: text("name").notNull(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestampColumns,
}, (table) => ({
  usernameUnique: uniqueIndex("platform_admins_username_unique").on(table.username),
}));

export const tenantRequestStatusEnum = pgEnum("tenant_request_status", ["pending", "approved", "rejected"]);

/**
 * No uniqueness on `requestedSlug` — two people can request the same desired slug; only one
 * can ever be approved into it, enforced by `tenants.slug`'s own unique index at approval
 * time. No soft-delete: a request's terminal state is `approved`/`rejected`, never deleted —
 * nothing in this design ever needs to hide a request from the superadmin's own history view.
 */
export const tenantRequests = pgTable("tenant_requests", {
  ...idColumn,
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  requestedSlug: text("requested_slug").notNull(),
  notes: text("notes"),
  status: tenantRequestStatusEnum("status").notNull().default("pending"),
  reviewedByPlatformAdminId: uuid("reviewed_by_platform_admin_id").references(() => platformAdmins.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdTenantId: uuid("created_tenant_id").references(() => tenants.id),
  ...timestampColumns,
});
