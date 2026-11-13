CREATE TABLE "exercise_alternatives" (
	"exercise_id" uuid NOT NULL,
	"alternative_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_alternatives_exercise_id_alternative_id_pk" PRIMARY KEY("exercise_id","alternative_id")
);
--> statement-breakpoint
CREATE TABLE "warmup_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"focus" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "load_type" text DEFAULT 'external' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "base_program_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "preview" jsonb;--> statement-breakpoint
ALTER TABLE "program_days" ADD COLUMN "focus" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "client_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "client_edit_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "warmup_status" text;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "resolution_note" text;--> statement-breakpoint
UPDATE "exercises" SET "load_type" = 'bodyweight'
  WHERE "machine_id" IN (SELECT "id" FROM "machines" WHERE "name" ILIKE 'Коврик%');
--> statement-breakpoint
UPDATE "exercises" SET "load_type" = 'bodyweight_plus'
  WHERE "load_type" = 'external'
    AND ("name" ILIKE 'Подтягивани%' OR "name" ILIKE 'Отжимания%');
