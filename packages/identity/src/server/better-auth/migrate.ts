import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { authMigrationSql, betterAuthMigrationPlan } from "#server/better-auth/adapters/migrationPlan.ts";
import { type AuthSchemaDeclaration, storedRole } from "#server/better-auth/define.ts";

export const migrateBetterAuth = Effect.fn("Identity.migrateBetterAuth")(function* (auth: AuthSchemaDeclaration) {
	const plan = yield* betterAuthMigrationPlan(auth.options, storedRole(auth));
	const sql = yield* SqlClient.SqlClient;
	yield* sql.unsafe(authMigrationSql(plan.ddl));
});
