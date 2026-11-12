ALTER TABLE "programs" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "template_number" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "programs_template_number_unique" ON "programs" USING btree ("gym_id","template_number") WHERE "programs"."owner_id" IS NULL AND "programs"."template_number" IS NOT NULL;