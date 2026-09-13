CREATE TYPE "public"."tenant_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"requested_slug" text NOT NULL,
	"notes" text,
	"status" "tenant_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_platform_admin_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_tenant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Asymmetric default (PHASE_11_TASKS.md Workstream D, Decision D1): every tenant that
-- already exists must come out of this migration as `profile_completed = true` — they've
-- been operating fine without this concept, and a naive `DEFAULT false` here would
-- retroactively force every one of them (including the seeded siam-suits dev tenant and
-- every test-fixture helper's tenant) through Workstream G's forced onboarding redirect.
-- Only tenants inserted after this migration runs should default to incomplete.
ALTER TABLE "tenants" ADD COLUMN "profile_completed" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "profile_completed" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_requests" ADD CONSTRAINT "tenant_requests_reviewed_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("reviewed_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_requests" ADD CONSTRAINT "tenant_requests_created_tenant_id_tenants_id_fk" FOREIGN KEY ("created_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_admins_username_unique" ON "platform_admins" USING btree ("username");