import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import type { Pool } from "pg";

export function authOptions(database: Pool) {
	return {
		advanced: { database: { validateSchema: true } },
		database,
		disabledPaths: ["/admin/set-role", "/admin/update-user", "/admin/create-user"],
		emailAndPassword: { enabled: true },
		plugins: [admin({ roles: { admin: adminAc, owner: userAc, user: userAc } })],
		session: { cookieCache: { enabled: false } },
	} satisfies BetterAuthOptions;
}
