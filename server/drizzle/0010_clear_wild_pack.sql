CREATE TYPE "public"."feature_render_slot" AS ENUM('shoulder_type', 'monogram_position');--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "is_additional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "is_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "render_slot" "feature_render_slot";--> statement-breakpoint
ALTER TABLE "order_item_components" ADD COLUMN "measurement_note" text;--> statement-breakpoint
ALTER TABLE "order_item_components" ADD COLUMN "styling_note" text;--> statement-breakpoint
ALTER TABLE "order_item_components" ADD COLUMN "reference_image" text;