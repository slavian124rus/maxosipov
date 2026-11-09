ALTER TABLE "next_weights" ALTER COLUMN "weight_kg" SET DATA TYPE double precision USING round("weight_kg"::numeric, 2)::double precision;--> statement-breakpoint
ALTER TABLE "program_exercises" ALTER COLUMN "target_weight_kg" SET DATA TYPE double precision USING round("target_weight_kg"::numeric, 2)::double precision;--> statement-breakpoint
ALTER TABLE "set_logs" ALTER COLUMN "weight_kg" SET DATA TYPE double precision USING round("weight_kg"::numeric, 2)::double precision;--> statement-breakpoint
UPDATE "programs" SET "status" = 'archived' WHERE "id" IN (SELECT "id" FROM (SELECT "id", row_number() OVER (PARTITION BY "owner_id" ORDER BY "updated_at" DESC) AS rn FROM "programs" WHERE "owner_id" IS NOT NULL AND "status" = 'active') AS duplicates WHERE rn > 1);--> statement-breakpoint
CREATE UNIQUE INDEX "programs_one_active_per_owner" ON "programs" USING btree ("owner_id") WHERE "programs"."status" = 'active' AND "programs"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "set_logs_session_idx" ON "set_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "set_logs_exercise_idx" ON "set_logs" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workout_sessions_user_started_idx" ON "workout_sessions" USING btree ("user_id","started_at" desc);--> statement-breakpoint
CREATE INDEX "workout_sessions_user_finished_idx" ON "workout_sessions" USING btree ("user_id") WHERE "workout_sessions"."finished_at" IS NOT NULL;
