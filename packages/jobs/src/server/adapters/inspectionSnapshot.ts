import { Schema } from "effect";
import type { PgBossClient } from "#server/adapters/client.ts";
import { inspectionOperation } from "#server/adapters/inspectionOperation.ts";
import { quotedSchema } from "#server/storedRows.ts";

const Rows = Schema.Array(
	Schema.Struct({
		data: Schema.Unknown,
		id: Schema.String,
		queue: Schema.String,
		startAfter: Schema.DateTimeUtcFromDate,
		state: Schema.Literals(["created", "retry", "deferred", "active", "failed"]),
	}),
);

export function inspectionSnapshot(client: PgBossClient, schema: string) {
	return (queues: readonly { readonly name: string }[]) =>
		inspectionOperation(async () => {
			const quoted = quotedSchema(schema);
			const db = client.getDb?.();
			if (db === undefined) {
				throw new TypeError("This pg-boss client does not support getDb");
			}
			const { rows } = await db.executeSql(
				`SELECT id, name AS queue, data, start_after AS "startAfter",
    CASE WHEN state = 'retry' AND started_on IS NULL AND start_after > ${quoted}.job_now()
     AND output ? 'jobDeferral'
    THEN 'deferred' ELSE state::text END AS state
    FROM ${quoted}.job
    WHERE name = ANY($1::text[]) AND state IN ('created', 'retry', 'active', 'failed')
    ORDER BY created_on, id`,
				[queues.map(({ name }) => name)],
			);
			return Schema.decodeUnknownPromise(Rows)(rows);
		});
}
