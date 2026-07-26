CREATE TABLE "user" (
	id uuid NOT NULL,
	email text NOT NULL,
	name text NOT NULL,
	CONSTRAINT "User_pkey" PRIMARY KEY (id),
	CONSTRAINT "User_email_key" UNIQUE (email)
);

CREATE TABLE "post" (
	id uuid NOT NULL,
	title text NOT NULL,
	user_id uuid NOT NULL,
	reviewer_id uuid,
	CONSTRAINT "Post_pkey" PRIMARY KEY (id),
	CONSTRAINT "Post_user_id_fkey" FOREIGN KEY (user_id)
		REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "Post_reviewer_id_fkey" FOREIGN KEY (reviewer_id)
		REFERENCES "user" (id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Post_user_id_idx" ON "post" (user_id);
CREATE INDEX "Post_reviewer_id_idx" ON "post" (reviewer_id);
