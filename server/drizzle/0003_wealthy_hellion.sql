CREATE TABLE IF NOT EXISTS "tailor_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tailor_id" uuid NOT NULL,
	"process_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker_advance_payments" ADD COLUMN "payment_settlement_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tailor_processes" ADD CONSTRAINT "tailor_processes_tailor_id_tailors_id_fk" FOREIGN KEY ("tailor_id") REFERENCES "public"."tailors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tailor_processes" ADD CONSTRAINT "tailor_processes_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tailor_processes_unique" ON "tailor_processes" USING btree ("tailor_id","process_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_advance_payments" ADD CONSTRAINT "worker_advance_payments_payment_settlement_id_payment_settlements_id_fk" FOREIGN KEY ("payment_settlement_id") REFERENCES "public"."payment_settlements"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
