import { Effect, Schema } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { quotedSchema } from "#internal/storedRows.ts";

const Count = Schema.Struct({ count: Schema.NumberFromString });

export const deferralCount = Effect.fnUntraced(function* (client: PgBossClient, schema: string, job: Job<unknown>) {
	const quoted = quotedSchema(schema);
	return yield* Effect.tryPromise({
		catch: (error) => toPgBossError("settle", error, job.name),
		try: async () => {
			if (client.getDb === undefined) {
				throw new TypeError("This pg-boss client does not support getDb for deferral counts");
			}
			const { rows } = await client.getDb().executeSql(
				`SELECT COALESCE((
					SELECT deferred.count FROM ${quoted}.effect_job_deferral AS deferred
					JOIN ${quoted}.job AS job USING (name, id, created_on)
					WHERE job.name = $1 AND job.id = $2
				), 0)::text AS count`,
				[job.name, job.id],
			);
			return Schema.decodeUnknownSync(Count)(rows[0]).count;
		},
	});
});
