import type { BetterAuthOptions } from "better-auth";

export function authOptions() {
	return {
		advanced: { database: { validateSchema: true } },
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
	} satisfies BetterAuthOptions;
}
