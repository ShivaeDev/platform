import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";

export interface UpsertRow<TRow> {
	readonly inserted: boolean;
	readonly row: TRow;
}

export function upsertReturning(sql: SqlClient.SqlClient) {
	return sql`*, (xmax = 0) as ${sql("effectSqlInserted")}`;
}

export function makeUpsertDecoder(model: Model.Any) {
	const decode = Schema.decodeUnknownEffect(model);
	return (row: Readonly<Record<string, unknown>> | undefined) =>
		Effect.map(decode(row), (decoded) => ({ inserted: row?.effectSqlInserted === true, row: decoded }));
}
