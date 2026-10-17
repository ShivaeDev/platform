import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { recordJson } from "#storage/model.ts";

export const readDecisionRecords = Effect.fn("Test.readDecisionRecords")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql`select * from ${sql(`${namespace}_records`)} where work_id = 'one'`;
	return yield* Effect.forEach(rows, (row) =>
		recordJson(row, namespace).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))),
			Effect.map((payload) => ({ payload, version: Number(row.version) + 1 })),
		),
	);
});
