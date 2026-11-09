CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" double precision,
	"chest_cm" double precision,
	"waist_cm" double precision,
	"hips_cm" double precision,
	"biceps_cm" double precision,
	"thigh_cm" double precision,
	"entered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_measurements_user_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"pose" text NOT NULL,
	"media_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_photos_media_id_unique" UNIQUE("media_id")
);
--> statement-breakpoint
CREATE INDEX "body_measurements_user_date_idx" ON "body_measurements" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "progress_photos_user_date_idx" ON "progress_photos" USING btree ("user_id","date");