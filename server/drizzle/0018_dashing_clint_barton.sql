ALTER TABLE "order_item_components" DROP CONSTRAINT "order_item_components_baseline_component_id_order_item_components_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_item_components" ADD CONSTRAINT "order_item_components_baseline_component_id_order_item_components_id_fk" FOREIGN KEY ("baseline_component_id") REFERENCES "public"."order_item_components"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
