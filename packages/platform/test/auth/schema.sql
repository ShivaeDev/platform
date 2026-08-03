CREATE TABLE "auth_user" (
	id uuid NOT NULL,
	email text NOT NULL,
	name text NOT NULL,
	email_verified boolean NOT NULL DEFAULT false,
	image text,
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "AuthUser_pkey" PRIMARY KEY (id),
	CONSTRAINT "AuthUser_email_key" UNIQUE (email)
);
