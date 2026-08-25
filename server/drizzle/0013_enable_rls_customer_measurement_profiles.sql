-- Custom SQL migration file, put your code below! --

-- `customer_measurement_profiles` (PHASE_10_TASKS.md Workstream D Group 0) carries its own
-- tenant_id like products/processes/features/product_fittings, so it gets the same policy
-- those tables got. `customer_measurement_profile_values` deliberately gets none, scoped
-- transitively through `customer_measurement_profiles`, same reasoning as
-- `product_measurements`/`fitting_values`.
ALTER TABLE "customer_measurement_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customer_measurement_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "customer_measurement_profiles" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
