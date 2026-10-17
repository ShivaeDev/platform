import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";

export function authOptions(database: Pool) {
	return { database, emailAndPassword: { enabled: true } } satisfies BetterAuthOptions;
}
