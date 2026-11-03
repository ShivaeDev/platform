import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

const Column = Schema.Struct({ name: Schema.String, type: Schema.String });

export type PostgresColumn = typeof Column.Type;

export const tableColumns = Effect.fn("PostgresTest.tableColumns")(function* (table: string) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql`
		select attname as name, format_type(atttypid, atttypmod) as type
		from pg_attribute
		where attrelid = ${table}::regclass and attnum > 0 and not attisdropped
		order by attname`.withoutTransform.pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Column))));
});
