import { Clock, DateTime, Effect, Schema } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { RetryAt } from "#definition.ts";
import { deferralObservers, deferralOf, deferredAttempt } from "#internal/deferral.ts";

const recordDeferral = Effect.fnUntraced(function* (at: string, reason: string) {
	const span = yield* Effect.currentSpan.pipe(Effect.orDie);
	span.event("job.deferred", yield* Clock.currentTimeNanos, { at, reason });
});

export function deferrableAttempt<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	client: PgBossClient,
	schema: string,
	job: Job<unknown>,
	maxDeferrals: number,
) {
	return effect.pipe(
		Effect.catchIf(Schema.is(RetryAt), (error) => {
			const count = deferralOf(job)?.count ?? 0;
			if (count >= maxDeferrals) {
				return Effect.fail(error);
			}
			const at = DateTime.formatIso(error.at);
			return Effect.promise(async () => {
				if (client.getDb === undefined) {
					throw new TypeError("This pg-boss client does not support getDb for RetryAt");
				}
				const quoted = `"${schema.replaceAll('"', '""')}"`;
				const { rows } = await client.getDb().executeSql(
					`UPDATE ${quoted}.job SET state = 'retry', start_after = $4::timestamptz,
					keep_until = GREATEST(keep_until, $4::timestamptz + (keep_until - start_after)),
					started_on = NULL, heartbeat_on = NULL, output = $5::jsonb
					WHERE name = $1 AND id = $2 AND state = 'active' AND retry_count = $3
					AND date_trunc('milliseconds', started_on) = $6::timestamptz
					RETURNING id`,
					[
						job.name,
						job.id,
						job.retryCount,
						at,
						JSON.stringify({ jobDeferral: { at, count: count + 1, reason: error.reason } }),
						Reflect.get(job, "startedOn"),
					],
				);
				// Native batch settlement must not match a sibling's new claim at the unchanged retry count.
				job.retryCount = Number.MAX_SAFE_INTEGER;
				if (rows.length > 0) {
					deferralObservers.get(client)?.();
				}
				return rows.length > 0;
			}).pipe(
				Effect.tap((settled) => (settled ? recordDeferral(at, error.reason) : Effect.void)),
				Effect.as(deferredAttempt),
			);
		}),
	);
}
