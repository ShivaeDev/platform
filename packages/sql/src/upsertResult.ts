import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storageSchema } from "#adapters/storageSchema.ts";
import type { SqlNameTransforms } from "#clientOptions.ts";

export interface UpsertRow<TRow> {
	readonly inserted: boolean;
	readonly row: TRow;
}

export const upsertReturning = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	return sql`*, (xmax = 0) as ${sql("effectSqlInserted")}`;
});

export function makeUpsertDecoder(model: Model.Any, names?: SqlNameTransforms) {
	const decode = Schema.decodeUnknownEffect(storageSchema(model, model.fields, names));
	return (row: Readonly<Record<string, unknown>> | undefined) =>
		Effect.map(decode(row), (decoded) => ({ inserted: row?.effectSqlInserted === true, row: decoded }));
}
