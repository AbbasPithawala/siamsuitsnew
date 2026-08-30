ALTER TABLE "extra_payments" ADD COLUMN "rejected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "extra_payments" ADD COLUMN "rejected_at" timestamp with time zone;