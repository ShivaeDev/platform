import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { authMigrationSql, betterAuthMigrationPlan } from "#server/better-auth/adapters/migrationPlan.ts";
import type { StoredRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";

export const migrateBetterAuth = Effect.fn("Identity.migrateBetterAuth")(function* (
	options: Omit<BetterAuthOptions, "database">,
	role?: StoredRoleOptions,
) {
	const plan = yield* betterAuthMigrationPlan(options, role);
	const sql = yield* SqlClient.SqlClient;
	yield* sql.unsafe(authMigrationSql(plan.ddl));
});
