import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { type StoredRoleOptions, storedRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";

export const migrateBetterAuth = Effect.fn("Identity.migrateBetterAuth")(function* (
	options: Omit<BetterAuthOptions, "database">,
	role?: StoredRoleOptions,
) {
	const database = yield* betterAuthDatabase();
	const migration = yield* Effect.tryPromise(() => getMigrations({ ...storedRoleOptions(options, role), database }));
	yield* Effect.tryPromise(() => migration.runMigrations());
	if (role !== undefined) {
		const sql = yield* SqlClient.SqlClient;
		const table = sql(options.user?.modelName ?? "user");
		const defaultValue = sql.literal(`'${role.defaultRole.replaceAll("'", "''")}'`);
		yield* sql`alter table ${table} alter column role set default ${defaultValue}`;
		yield* sql`update ${table} set role = ${role.defaultRole} where role is null`;
		yield* sql`alter table ${table} alter column role set not null`;
	}
});
