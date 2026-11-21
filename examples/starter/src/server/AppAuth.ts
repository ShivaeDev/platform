import { defineAuth } from "@shivaedev/identity/server/better-auth/define.ts";
import { AppAccess } from "#AppAccess.ts";
import { User } from "#roles/User.ts";

export const AppAuth = defineAuth({
	defaultRole: User.name,
	options: {
		advanced: { database: { validateSchema: true } },
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
		user: { changeEmail: { enabled: true } },
	},
	roles: AppAccess,
});
