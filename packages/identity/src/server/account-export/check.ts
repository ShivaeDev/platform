import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import type { UserDataExport, UserExportReference } from "#server/userDataExport.ts";

export class UnregisteredUserExportTables extends Schema.TaggedError<UnregisteredUserExportTables>()("UnregisteredUserExportTables", {
	tables: Schema.Array(Schema.Struct({ schema: Schema.String, table: Schema.String })),
}) {
	override get message() {
		return `User data export registrations are missing for: ${this.tables.map(({ schema, table }) => `${schema}.${table}`).join(", ")}`;
	}
}

export const checkUserDataExports = Effect.fn("Identity.checkUserDataExports")(function* (
	registrations: Readonly<Record<string, UserDataExport>>,
	reference: UserExportReference,
) {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const tables = yield* SqlSchema.findAll({
		execute: () => sql`
		select distinct source_schema.nspname as schema, source.relname as table
		from pg_catalog.pg_constraint fk
		join pg_catalog.pg_class source on source.oid = fk.conrelid
		join pg_catalog.pg_namespace source_schema on source_schema.oid = source.relnamespace
		join pg_catalog.pg_class target on target.oid = fk.confrelid
		join pg_catalog.pg_namespace target_schema on target_schema.oid = target.relnamespace
		join pg_catalog.pg_attribute target_column on target_column.attrelid = target.oid and target_column.attnum = any(fk.confkey)
		where fk.contype = 'f' and target_schema.nspname = ${reference.schema}
			and target.relname = ${reference.table} and target_column.attname = ${reference.column}
		order by schema, "table"`,
		Request: Schema.Void,
		Result: Schema.Struct({ schema: Schema.String, table: Schema.String }),
	})(undefined);
	const registered = Object.values(registrations).flatMap((registration) => registration.tables);
	const missing = tables.filter((table) => !registered.some((entry) => entry.schema === table.schema && entry.table === table.table));
	if (missing.length > 0) {
		return yield* new UnregisteredUserExportTables({ tables: missing });
	}
});
