-- Custom SQL migration file, put your code below! --

-- `product_fittings` was added after `0001_enable_row_level_security.sql` (PHASE_8_TASKS.md
-- Group 6) — it carries its own tenant_id like products/processes/features, so it gets the
-- same policy those tables got there. `fitting_values` deliberately gets none, scoped
-- transitively through `product_fittings`, same reasoning as `product_measurements`.
ALTER TABLE "product_fittings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "product_fittings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "product_fittings" USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
