import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	rules: {
		"boundaries/auth-sql": {
			options: { owners: ["src/server/migrations/0001_auth.ts", "src/server/migrations/0004_stored_roles.ts"] },
		},
	},
});
