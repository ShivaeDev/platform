import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	rules: {
		"boundaries/auth-sql": {
			options: {
				owners: [
					{ glob: "src/server/migrations/0001_auth.ts", reason: "The auth implementation and its migrations own auth storage." },
					{ glob: "src/server/migrations/0004_stored_roles.ts", reason: "The auth implementation and its migrations own auth storage." },
				],
			},
		},
	},
});
