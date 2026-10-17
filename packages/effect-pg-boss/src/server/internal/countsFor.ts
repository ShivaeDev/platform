import { Effect, Schema } from "effect";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import type { QueueCounts } from "#health.ts";

const Counts = Schema.Struct({
	activeCount: Schema.Number,
	failedCount: Schema.Number,
	queuedCount: Schema.Number,
	totalCount: Schema.Number,
});

export function countsFor(client: PgBossClient, schema: string, name: string): Effect.Effect<QueueCounts, import("#error.ts").PgBossError> {
	return Effect.tryPromise({
		catch: (error) => toPgBossError("counts", error, name),
		try: async () => {
			if (client.getDb === undefined) {
				throw new TypeError("This pg-boss client does not support getDb");
			}
			const quotedSchema = `"${schema.replaceAll('"', '""')}"`;
			const { rows } = await client.getDb().executeSql(
				`SELECT
					count(*) FILTER (WHERE state = 'active')::int AS "activeCount",
					count(*) FILTER (WHERE state = 'failed')::int AS "failedCount",
					count(*) FILTER (WHERE state IN ('created', 'retry'))::int AS "queuedCount",
					count(*)::int AS "totalCount"
				FROM ${quotedSchema}.job WHERE name = $1`,
				[name],
			);
			return Schema.decodeUnknownPromise(Counts)(rows[0]);
		},
	});
}
