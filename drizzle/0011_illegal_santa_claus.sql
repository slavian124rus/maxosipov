CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"original_path" text,
	"processed_paths" jsonb,
	"error" text,
	"size_bytes" integer NOT NULL,
	"mime" text NOT NULL,
	"received_chunks" integer[] DEFAULT '{}' NOT NULL,
	"total_chunks" integer NOT NULL,
	"processing_options" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
