CREATE TABLE IF NOT EXISTS "customer_measurement_profile_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"measurement_definition_id" uuid NOT NULL,
	"value" numeric(10, 2),
	"adjustment_value" numeric(10, 2),
	"total_value" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_measurement_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "order_item_component_measurements" ADD COLUMN "changed_from_profile" boolean;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_measurement_profile_values" ADD CONSTRAINT "customer_measurement_profile_values_profile_id_customer_measurement_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."customer_measurement_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_measurement_profile_values" ADD CONSTRAINT "customer_measurement_profile_values_measurement_definition_id_measurement_definitions_id_fk" FOREIGN KEY ("measurement_definition_id") REFERENCES "public"."measurement_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_measurement_profiles" ADD CONSTRAINT "customer_measurement_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_measurement_profiles" ADD CONSTRAINT "customer_measurement_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_measurement_profiles" ADD CONSTRAINT "customer_measurement_profiles_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_measurement_profile_values_unique" ON "customer_measurement_profile_values" USING btree ("profile_id","measurement_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_measurement_profiles_unique" ON "customer_measurement_profiles" USING btree ("tenant_id","customer_id","product_id");