import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import { userAc } from "better-auth/plugins/admin/access";
import type { Pool } from "pg";
import { AppAccess } from "#AppAccess.ts";
import { User } from "#roles/User.ts";

export function authOptions(database: Pool) {
	return {
		advanced: { database: { validateSchema: true } },
		database,
		disabledPaths: ["/admin/set-role", "/admin/update-user", "/admin/create-user"],
		emailAndPassword: { enabled: true },
		plugins: [admin({ adminRoles: [], defaultRole: User.name, roles: Object.fromEntries(AppAccess.Role.literals.map((name) => [name, userAc])) })],
		session: { cookieCache: { enabled: false } },
	} satisfies BetterAuthOptions;
}
