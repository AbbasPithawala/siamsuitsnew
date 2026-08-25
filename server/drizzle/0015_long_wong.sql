ALTER TABLE "products" ADD COLUMN "measurement_diagram_image" text;--> statement-breakpoint
ALTER TABLE "order_item_components" ADD COLUMN "manual_size_image" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_modified_at" timestamp with time zone;