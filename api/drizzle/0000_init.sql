CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

CREATE TABLE "products" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"description" text,
	"price_usd_cents" integer,
	"image_url" text,
	"embedding" vector(384),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "products_embedding_hnsw" ON "products" USING hnsw ("embedding" vector_cosine_ops);