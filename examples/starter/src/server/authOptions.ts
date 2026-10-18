import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import type { Pool } from "pg";

export function authOptions(database: Pool) {
	return {
		advanced: { database: { validateSchema: true } },
		database,
		emailAndPassword: { enabled: true },
		plugins: [admin()],
		session: { cookieCache: { enabled: false } },
	} satisfies BetterAuthOptions;
}
