export const authStorage = {
	file: {
		content: [
			'CREATE TABLE "user" (id text, email text, emailVerified boolean);',
			"CREATE TABLE account (id text, accountId text, providerId text, userId text);",
			"CREATE TABLE session (id text, token text, userId text, expiresAt timestamp);",
			"CREATE TABLE verification (id text, identifier text, value text, expiresAt timestamp);",
		].join("\n"),
		path: "auth/schema.sql",
	},
	owners: [{ glob: "auth/**", reason: "Better Auth owns this schema." }],
};
