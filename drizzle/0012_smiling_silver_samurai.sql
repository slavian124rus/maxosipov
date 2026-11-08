CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"machine_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"primary_muscles" text[] DEFAULT '{}' NOT NULL,
	"secondary_muscles" text[] DEFAULT '{}' NOT NULL,
	"video_media_id" uuid,
	"overlay_profile" text DEFAULT 'none' NOT NULL,
	"steps" text[] DEFAULT '{}' NOT NULL,
	"mistakes" text[] DEFAULT '{}' NOT NULL,
	"tips" text,
	"default_rep_min" integer DEFAULT 8 NOT NULL,
	"default_rep_max" integer DEFAULT 12 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_gym_slug_unique" UNIQUE("gym_id","slug")
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"zone" text,
	"weight_step_kg" real DEFAULT 5 NOT NULL,
	"photo_media_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
