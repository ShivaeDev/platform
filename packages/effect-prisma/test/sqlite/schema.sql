-- Mirrors `prisma-next db init` for the SQLite contract, including the
-- generated `datetime('now')` default. That default writes a zone-less
-- `YYYY-MM-DD HH:MM:SS` string, which the SQLite entrypoint decodes as UTC.
CREATE TABLE "user" (
	"id" TEXT NOT NULL,
	"email" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"created_at" TEXT NOT NULL DEFAULT (datetime('now')),
	"verified_at" TEXT,
	PRIMARY KEY ("id"),
	CONSTRAINT "User_email_key" UNIQUE ("email")
);

CREATE TABLE "post" (
	"id" TEXT NOT NULL,
	"title" TEXT NOT NULL,
	"user_id" TEXT NOT NULL,
	"reviewer_id" TEXT,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("user_id") REFERENCES "user" ("id"),
	FOREIGN KEY ("reviewer_id") REFERENCES "user" ("id")
);

CREATE INDEX "Post_user_id_idx" ON "post" ("user_id");
CREATE INDEX "Post_reviewer_id_idx" ON "post" ("reviewer_id");
