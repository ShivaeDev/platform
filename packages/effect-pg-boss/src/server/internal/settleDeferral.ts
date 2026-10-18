import { Schema } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";

const Settlement = Schema.Struct({ claimed: Schema.Boolean, deferred: Schema.Boolean });

export async function settleDeferral(client: PgBossClient, schema: string, job: Job<unknown>, at: string, reason: string, maxDeferrals: number) {
	if (client.getDb === undefined) {
		throw new TypeError("This pg-boss client does not support getDb for RetryAt");
	}
	const quoted = `"${schema.replaceAll('"', '""')}"`;
	// Native failure settlement deletes and reinserts jobs, so a cascading job foreign key would erase the counter.
	const { rows } = await client.getDb().executeSql(
		`WITH claimed AS MATERIALIZED (
			SELECT name, id, created_on,
				GREATEST(keep_until, $4::timestamptz + (keep_until - start_after)) AS keep_until
			FROM ${quoted}.job
			WHERE name = $1 AND id = $2 AND state = 'active' AND retry_count = $3
			AND date_trunc('milliseconds', started_on) = $6::timestamptz
			FOR UPDATE
		), counted AS (
			INSERT INTO ${quoted}.effect_job_deferral AS previous (name, id, created_on, count, keep_until)
			SELECT name, id, created_on, 1, keep_until FROM claimed
			ON CONFLICT (name, id) DO UPDATE SET
				count = CASE WHEN previous.created_on = EXCLUDED.created_on THEN previous.count + 1 ELSE 1 END,
				created_on = EXCLUDED.created_on, keep_until = EXCLUDED.keep_until
			WHERE previous.created_on <> EXCLUDED.created_on OR previous.count < $7
			RETURNING name, id, keep_until
		), deferred AS (
			UPDATE ${quoted}.job AS job SET state = 'retry', start_after = $4::timestamptz,
				keep_until = counted.keep_until, started_on = NULL, heartbeat_on = NULL,
				output = jsonb_build_object('jobDeferral', jsonb_build_object('at', $4::text, 'reason', $5::text))
			FROM counted WHERE job.name = counted.name AND job.id = counted.id
			RETURNING job.id
		), cleaned AS (
			DELETE FROM ${quoted}.effect_job_deferral WHERE (name, id) IN (
				SELECT stale.name, stale.id FROM ${quoted}.effect_job_deferral AS stale
				WHERE EXISTS (SELECT 1 FROM counted) AND stale.keep_until < ${quoted}.job_now()
				AND (stale.name, stale.id) <> ($1, $2)
				AND NOT EXISTS (
					SELECT 1 FROM ${quoted}.job AS live
					WHERE live.name = stale.name AND live.id = stale.id AND live.created_on = stale.created_on
				)
				ORDER BY stale.name, stale.id LIMIT 100 FOR UPDATE OF stale SKIP LOCKED
			)
		)
		SELECT EXISTS (SELECT 1 FROM claimed) AS claimed, EXISTS (SELECT 1 FROM deferred) AS deferred`,
		[job.name, job.id, job.retryCount, at, reason, Reflect.get(job, "startedOn"), maxDeferrals],
	);
	return Schema.decodeUnknownSync(Settlement)(rows[0]);
}
