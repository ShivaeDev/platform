import type { BetterAuthOptions } from "better-auth";
import { getSchema } from "better-auth/db";
import { matchType } from "better-auth/db/migration";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { StoredRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";

interface Column {
	readonly column: string;
	readonly default: string | null;
	readonly nullable: string;
	readonly table: string;
	readonly type: string;
}

function columnProblems(
	table: string,
	name: string,
	field: ReturnType<typeof getSchema>[string]["fields"][string],
	column: Column | undefined,
	serialIds: boolean,
) {
	if (column === undefined) {
		return [];
	}
	const type = (name === "id" || field.references?.field === "id") && serialIds ? "number" : field.type;
	const missing: string[] = [];
	if (!matchType(column.type, type, "postgres")) {
		missing.push(`column ${table}.${name} requires type ${type} (found ${column.type})`);
	}
	if (field.required !== false && column.nullable === "YES") {
		missing.push(`column ${table}.${name} requires NOT NULL`);
	}
	return missing;
}

export const authColumnDrift = Effect.fnUntraced(function* (options: BetterAuthOptions, role?: StoredRoleOptions) {
	const sql = yield* SqlClient.SqlClient;
	const columns = yield* sql<Column>`
		select table_name as "table", column_name as "column", udt_name as type, is_nullable as nullable, column_default as "default"
		from information_schema.columns where table_schema = current_schema()`.withoutTransform;
	const missing: string[] = [];
	for (const [table, schema] of Object.entries(getSchema(options))) {
		if (schema.disableMigrations) {
			continue;
		}
		for (const [name, field] of Object.entries(schema.fields)) {
			const column = columns.find((value) => value.table === table && value.column === name);
			missing.push(...columnProblems(table, name, field, column, options.advanced?.database?.generateId === "serial"));
		}
	}
	if (role !== undefined) {
		const table = options.user?.modelName ?? "user";
		const column = columns.find((entry) => entry.table === table && entry.column === "role");
		const value = `'${role.defaultRole.replaceAll("'", "''")}'`;
		if (column !== undefined && column.default !== `${value}::text`) {
			missing.push(`column ${table}.role requires DEFAULT ${value}`);
		}
	}
	return missing;
});
