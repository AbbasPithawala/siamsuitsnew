ALTER TABLE "order_item_components" ADD COLUMN "baseline_component_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_item_components" ADD CONSTRAINT "order_item_components_baseline_component_id_order_item_components_id_fk" FOREIGN KEY ("baseline_component_id") REFERENCES "public"."order_item_components"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_id_order_date_idx" ON "orders" USING btree ("customer_id","order_date");