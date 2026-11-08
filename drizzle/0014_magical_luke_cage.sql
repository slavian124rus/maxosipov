CREATE TABLE "next_weights" (
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"weight_kg" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "next_weights_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
