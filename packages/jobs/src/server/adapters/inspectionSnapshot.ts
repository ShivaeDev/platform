import { Effect, Schema } from "effect";
import { inspectionOperation } from "#server/adapters/inspectionOperation.ts";
import type { PgBossClient } from "#server/client.ts";
import type { PgBossError, PgBossPayloadError } from "#server/error.ts";
import type { SnapshotQueue, UnfinishedJob } from "#server/inspection.ts";
import { decodeStoredData, quotedSchema } from "#server/internal/storedRows.ts";

const Rows = Schema.Array(
	Schema.Struct({
		data: Schema.Unknown,
		id: Schema.String,
		queue: Schema.String,
		startAfter: Schema.DateTimeUtcFromDate,
		state: Schema.Literals(["created", "retry", "deferred", "active", "failed"]),
	}),
);

export function inspectionSnapshot(client: () => PgBossClient, schema: () => string) {
	return <const TQueues extends readonly SnapshotQueue[]>(
		queues: TQueues,
	): Effect.Effect<readonly UnfinishedJob<TQueues[number]>[], PgBossPayloadError | PgBossError, TQueues[number]["schema"]["DecodingServices"]> => {
		const byName = new Map<string, TQueues[number]>(queues.map((queue) => [queue.name, queue]));
		return inspectionOperation(async () => {
			const quoted = quotedSchema(schema());
			const db = client().getDb?.();
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
				[[...byName.keys()]],
			);
			return Schema.decodeUnknownPromise(Rows)(rows);
		}).pipe(
			Effect.flatMap((rows) =>
				Effect.forEach(rows, ({ data, queue: name, ...row }) => {
					const queue = byName.get(name);
					if (queue === undefined) {
						return Effect.die(new Error(`The snapshot returned a job of an unrequested queue ${name}`));
					}
					return decodeStoredData<TQueues[number]["name"], TQueues[number]["schema"]>(queue, data).pipe(
						Effect.map((decoded): UnfinishedJob<TQueues[number]> => ({ ...row, data: decoded, queue: queue.name })),
					);
				}),
			),
		);
	};
}
