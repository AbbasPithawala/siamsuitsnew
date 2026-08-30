CREATE TYPE "public"."order_invoice_line_kind" AS ENUM('unit', 'additional', 'charge');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_invoice_id" uuid NOT NULL,
	"group_label" text NOT NULL,
	"kind" "order_invoice_line_kind" NOT NULL,
	"label" text NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"note" text,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pdf_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retailer_invoice_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_invoice_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "invoice_footer_text" text;--> statement-breakpoint
ALTER TABLE "retailer_invoices" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "retailer_invoices" ADD COLUMN "pdf_path" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_invoice_lines" ADD CONSTRAINT "order_invoice_lines_order_invoice_id_order_invoices_id_fk" FOREIGN KEY ("order_invoice_id") REFERENCES "public"."order_invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retailer_invoice_orders" ADD CONSTRAINT "retailer_invoice_orders_retailer_invoice_id_retailer_invoices_id_fk" FOREIGN KEY ("retailer_invoice_id") REFERENCES "public"."retailer_invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retailer_invoice_orders" ADD CONSTRAINT "retailer_invoice_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_invoices_order_id_unique" ON "order_invoices" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retailer_invoice_orders_order_id_unique" ON "retailer_invoice_orders" USING btree ("order_id");