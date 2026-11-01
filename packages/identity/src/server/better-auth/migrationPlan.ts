import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { type StoredRoleOptions, storedRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { tables } from "./tables.ts";

export const betterAuthMigrationPlan = Effect.fn("Identity.betterAuthMigrationPlan")(function* (
	options: Omit<BetterAuthOptions, "database">,
	role?: StoredRoleOptions,
	safety: { readonly throwOnUnsafe: boolean } = { throwOnUnsafe: true },
) {
	const database = yield* betterAuthDatabase();
	const plan = yield* Effect.tryPromise(() => getMigrations({ ...storedRoleOptions(options, role), database }, safety));
	const missing = [
		...plan.toBeCreated.map(({ table, fields }) => `table ${table} (${Object.keys(fields).join(", ")})`),
		...plan.toBeAdded.flatMap(({ table, fields }) => Object.keys(fields).map((field) => `column ${table}.${field}`)),
		...plan.toBeAddedIndexes.map(({ table, name }) => `index ${table}.${name}`),
		...plan.schemaProblems,
		...plan.unsafeChanges,
	];
	const compiled = yield* Effect.tryPromise(() => plan.compileMigrations());
	let ddl = compiled === ";" ? "" : compiled;
	if (role !== undefined) {
		const sql = (yield* SqlClient.SqlClient).withoutTransforms();
		const { user } = tables(options);
		const value = `'${role.defaultRole.replaceAll("'", "''")}'`;
		const identifier = sql`${sql(user.table)}`.compile()[0];
		const column = sql`${sql(user.role)}`.compile()[0];
		ddl += `\nalter table ${identifier} alter column ${column} set default ${value};\n`;
		ddl += `update ${identifier} set ${column} = ${value} where ${column} is null;\n`;
		ddl += `alter table ${identifier} alter column ${column} set not null;`;
	}
	return { ddl, missing };
});

export function authMigrationSql(ddl: string) {
	let tag = "$auth_migration$";
	while (ddl.includes(tag)) {
		tag = tag.replace("$auth", "$auth_");
	}
	// A DO block sends the compiled DDL as one statement on the native transaction connection.
	return `do ${tag}\nbegin\n${ddl}\nend;\n${tag};`;
}
