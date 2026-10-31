import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { StoredRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { authMigrationSql, betterAuthMigrationPlan } from "./migrationPlan.ts";

export const migrateBetterAuth = Effect.fn("Identity.migrateBetterAuth")(function* (
	options: Omit<BetterAuthOptions, "database">,
	role?: StoredRoleOptions,
) {
	const plan = yield* betterAuthMigrationPlan(options, role);
	const sql = yield* SqlClient.SqlClient;
	yield* sql.unsafe(authMigrationSql(plan.ddl));
});
