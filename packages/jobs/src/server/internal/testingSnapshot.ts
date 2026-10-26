import { Effect, Schema } from "effect";
import type { PgBoss } from "pg-boss";
import type { PgBossPayloadError, PgBossTestingError } from "#error.ts";
import { decodeStoredData, quotedSchema } from "#internal/storedRows.ts";
import { testingOperation } from "#internal/testingReadout.ts";
import type { SnapshotQueue, UnfinishedJob } from "#testing.ts";

const Rows = Schema.Array(
	Schema.Struct({
		data: Schema.Unknown,
		id: Schema.String,
		queue: Schema.String,
		startAfter: Schema.DateTimeUtcFromDate,
		state: Schema.Literals(["created", "retry", "active", "failed"]),
	}),
);

export function testingSnapshot(client: () => PgBoss, schema: () => string) {
	return <const TQueues extends readonly SnapshotQueue[]>(
		queues: TQueues,
	): Effect.Effect<
		readonly UnfinishedJob<TQueues[number]>[],
		PgBossPayloadError | PgBossTestingError,
		TQueues[number]["schema"]["DecodingServices"]
	> => {
		const byName = new Map<string, TQueues[number]>(queues.map((queue) => [queue.name, queue]));
		return testingOperation("snapshot", async () => {
			const quoted = quotedSchema(schema());
			const { rows } = await client()
				.getDb()
				.executeSql(
					`SELECT id, name AS queue, state, data, start_after AS "startAfter"
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
