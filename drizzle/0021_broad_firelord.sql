CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"source" text DEFAULT 'landing' NOT NULL,
	"ip" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_ip_created_idx" ON "leads" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "leads_phone_created_idx" ON "leads" USING btree ("phone","created_at");