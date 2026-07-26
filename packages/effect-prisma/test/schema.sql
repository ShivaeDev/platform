CREATE TABLE "user" (
	id uuid NOT NULL,
	email text NOT NULL,
	name text NOT NULL,
	CONSTRAINT "User_pkey" PRIMARY KEY (id),
	CONSTRAINT "User_email_key" UNIQUE (email)
);
