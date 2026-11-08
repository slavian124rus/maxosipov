ALTER TABLE "roles" ADD COLUMN "is_client" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "roles" SET "is_client" = true WHERE "name" = 'Клиент';
