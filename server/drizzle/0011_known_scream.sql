ALTER TABLE "super_products" ADD COLUMN "source_product_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "super_products" ADD CONSTRAINT "super_products_source_product_id_products_id_fk" FOREIGN KEY ("source_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "super_products_source_product_unique" ON "super_products" USING btree ("source_product_id");