import { makeCompiler } from "@effect/sql-pg/PgClient";
import { type Context, Effect } from "effect";
import * as Statement from "effect/sql/Statement";
import type { PgBossClient } from "#server/adapters/client.ts";
import type { JobEngine } from "#server/engine.ts";
import { toPgBossError } from "#server/error.ts";
import { deadLetterQueueName } from "#server/health.ts";
import { quotedSchema } from "#server/storedRows.ts";

const compiler = makeCompiler();

export function listJobs(client: PgBossClient, schema: string): Context.Service.Shape<typeof JobEngine>["listJobs"] {
	return (listing, queue, { limit, orderBy, seek }) =>
		Effect.tryPromise({
			catch: (error) => toPgBossError(listing, error, queue),
			try: async () => {
				if (client.getDb === undefined) {
					throw new TypeError("This pg-boss client does not support getDb");
				}
				const quoted = quotedSchema(schema);
				const query = Statement.fragment([
					Statement.literal(`SELECT
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
				WHERE name = `),
					Statement.parameter(listing === "failedJobs" ? queue : deadLetterQueueName(queue)),
					Statement.literal(listing === "failedJobs" ? " AND state = 'failed' AND " : " AND "),
					...seek.segments,
					Statement.literal(" ORDER BY "),
					...orderBy.segments,
					Statement.literal(" LIMIT "),
					Statement.parameter(limit),
				]);
				const [text, parameters] = compiler.compile(query, false);
				const { rows: storedRows } = await client.getDb().executeSql(text, [...parameters]);
				return storedRows;
			},
		});
}
