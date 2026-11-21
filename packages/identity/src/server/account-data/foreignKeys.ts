import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

const ForeignKeyColumn = Schema.Struct({
	column: Schema.String,
	onDelete: Schema.String,
	schema: Schema.String,
	table: Schema.String,
	target: Schema.Struct({ column: Schema.String, schema: Schema.String, table: Schema.String }),
});

export type ForeignKeyColumn = typeof ForeignKeyColumn.Type;

// One row per column pair, so a composite key such as (id, owner_id) shows which column points at a person.
export const foreignKeys = Effect.fn("Identity.foreignKeys")(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	return yield* SqlSchema.findAll({
		execute: () => sql`
		select source_schema.nspname as schema, source.relname as table, source_column.attname as column,
			fk.confdeltype::text as "onDelete",
			json_build_object('schema', target_schema.nspname, 'table', target.relname, 'column', target_column.attname) as target
		from pg_catalog.pg_constraint fk
		cross join lateral unnest(fk.conkey, fk.confkey) as pair(source_key, target_key)
		join pg_catalog.pg_class source on source.oid = fk.conrelid
		join pg_catalog.pg_namespace source_schema on source_schema.oid = source.relnamespace
		join pg_catalog.pg_attribute source_column on source_column.attrelid = source.oid and source_column.attnum = pair.source_key
		join pg_catalog.pg_class target on target.oid = fk.confrelid
		join pg_catalog.pg_namespace target_schema on target_schema.oid = target.relnamespace
		join pg_catalog.pg_attribute target_column on target_column.attrelid = target.oid and target_column.attnum = pair.target_key
		where fk.contype = 'f'
		order by schema, "table", "column"`,
		Request: Schema.Void,
		Result: ForeignKeyColumn,
	})(undefined);
});
