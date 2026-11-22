import { makeCompiler } from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import * as Statement from "effect/sql/Statement";
import type { KeysetPageQuery } from "@shivaedev/sql/keysetPage.ts";
import type { PgBossClient } from "#server/adapters/client.ts";
import { toPgBossError } from "#server/error.ts";
import { quotedSchema } from "#server/storedRows.ts";

const compiler = makeCompiler();

// Time left is measured against job_now() in the same statement, because the worker and pg-boss's expiry read that clock.
export function listActiveJobs(client: PgBossClient, schema: string, queue: string, { limit, orderBy, seek }: KeysetPageQuery) {
	return Effect.tryPromise({
		catch: (error) => toPgBossError("activeJobs", error, queue),
		try: async (): Promise<readonly unknown[]> => {
			if (client.getDb === undefined) {
				throw new TypeError("This pg-boss client does not support getDb");
			}
			const quoted = quotedSchema(schema);
			const deadline = "(started_on + expire_seconds * interval '1 second')";
			const query = Statement.fragment([
				Statement.literal(`SELECT
					id,
					name AS queue,
					retry_count AS "retryCount",
					started_on AS "startedOn",
					${deadline} AS deadline,
					(EXTRACT(EPOCH FROM ${deadline} - ${quoted}.job_now()) * 1000)::float8 AS "timeLeftMillis",
					to_json(started_on) #>> '{}' AS "cursorAt"
				FROM ${quoted}.job
				WHERE name = `),
				Statement.parameter(queue),
				Statement.literal(" AND state = 'active' AND "),
				...seek.segments,
				Statement.literal(" ORDER BY "),
				...orderBy.segments,
				Statement.literal(" LIMIT "),
				Statement.parameter(limit),
			]);
			const [text, parameters] = compiler.compile(query, false);
			const { rows } = await client.getDb().executeSql(text, [...parameters]);
			return rows;
		},
	});
}
