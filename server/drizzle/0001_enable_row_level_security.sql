-- Custom SQL migration file, put your code below! --

-- Dedicated low-privilege role that `withTenant()` (src/db/withTenant.ts) switches into
-- for the duration of a request's transaction via `SET LOCAL ROLE`. This is necessary
-- because the role the app's pooled connection normally authenticates as (see
-- DATABASE_URL) is a Postgres superuser in every environment set up so far, and
-- superusers unconditionally bypass row-level security (RLS) no matter how many
-- policies exist or whether FORCE ROW LEVEL SECURITY is set — that bypass cannot be
-- revoked. NOLOGIN because nothing ever authenticates as this role directly; a
-- superuser can always SET ROLE into it regardless of GRANT membership.
DO $$
BEGIN
  CREATE ROLE siam_tenant_scoped NOLOGIN NOBYPASSRLS;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO siam_tenant_scoped;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO siam_tenant_scoped;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO siam_tenant_scoped;
--> statement-breakpoint

-- Every table with a tenant_id column (see PHASE_2_TASKS.md Group 3). Pure join tables
-- without their own tenant_id (role_permissions, user_roles, retailer_users,
-- feature_products, super_product_components, product_processes, product_measurements,
-- order_items, order_item_components, order_item_component_measurements,
-- order_item_component_features, manufacturing_steps, extra_payments,
-- payment_settlement_jobs, shipping_box_items) are scoped transitively through the
-- tenant-scoped row they hang off of and are deliberately not given their own policy
-- here. `tenants` and `permissions` are the two tables with no tenant_id at all (root
-- tenant row / global catalog) and are likewise excluded.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "users" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "retailers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "retailers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "retailers" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "tailors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tailors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "tailors" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "roles" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "products" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "super_products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "super_products" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "super_products" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "processes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "processes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "processes" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "measurement_definitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "measurement_definitions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "measurement_definitions" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "features" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "features" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "features" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "customers" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "order_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_groups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "order_groups" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "orders" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "jobs" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "extra_payment_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "extra_payment_categories" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "extra_payment_categories" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "worker_advance_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "worker_advance_payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "worker_advance_payments" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "payment_settlements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_settlements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "payment_settlements" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "retailer_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "retailer_invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "retailer_invoices" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "shipping_boxes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shipping_boxes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "shipping_boxes" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
