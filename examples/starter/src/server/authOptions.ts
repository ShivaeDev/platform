import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import type { Pool } from "pg";

export function authOptions(database: Pool) {
	return { database, emailAndPassword: { enabled: true }, plugins: [admin()] } satisfies BetterAuthOptions;
}
