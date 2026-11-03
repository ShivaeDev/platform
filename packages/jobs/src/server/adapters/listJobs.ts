import { type Context, Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { toPgBossError } from "#server/error.ts";
import { deadLetterQueueName } from "#server/health.ts";
import type { JobEngine } from "#server/internal/engine.ts";
import { quotedSchema } from "#server/internal/storedRows.ts";

export function listJobs(client: PgBossClient, schema: string): Context.Service.Shape<typeof JobEngine>["listJobs"] {
	return (listing, queue, after, limit) =>
		Effect.tryPromise({
			catch: (error) => toPgBossError(listing, error, queue),
			try: async () => {
				if (client.getDb === undefined) {
					throw new TypeError("This pg-boss client does not support getDb");
				}
				const quoted = quotedSchema(schema);
				const { rows: storedRows } = await client.getDb().executeSql(
					`SELECT
					id,
					name AS queue,
					state,
					retry_count AS "retryCount",
					retry_limit AS "retryLimit",
					created_on AS "createdOn",
					started_on AS "startedOn",
					completed_on AS "completedOn",
					output,
					data,
					source_id AS "sourceId",
					source_output AS "sourceOutput",
					to_json(created_on) #>> '{}' AS "cursorAt"
				FROM ${quoted}.job
				WHERE name = $1
					${listing === "failedJobs" ? "AND state = 'failed'" : ""}
					AND ($2::timestamptz IS NULL OR (created_on, id) < ($2::timestamptz, $3::uuid))
				ORDER BY created_on DESC, id DESC
				LIMIT $4`,
					[listing === "failedJobs" ? queue : deadLetterQueueName(queue), after?.[0] ?? null, after?.[1] ?? null, limit + 1],
				);
				return storedRows;
			},
		});
}
