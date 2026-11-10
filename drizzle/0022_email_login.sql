ALTER TABLE "otp_codes" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
CREATE INDEX "otp_codes_email_created_idx" ON "otp_codes" USING btree ("email","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_contact_check" CHECK ("users"."email" is not null or "users"."phone" is not null);