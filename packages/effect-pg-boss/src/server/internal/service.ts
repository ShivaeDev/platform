import { Effect, Option, Redacted, Schema } from "effect";
import type { PgBossClient } from "#client.ts";
import { type PgBossError, PgBossPayloadError, toPgBossError } from "#error.ts";
import { countsFor } from "#internal/countsFor.ts";
import { healthFor } from "#internal/health.ts";
import { getJobFor, retryFor } from "#internal/jobControl.ts";
import { deadLetteredJobsFor, failedJobsFor } from "#internal/listJobs.ts";
import { capturePayload } from "#internal/tracing.ts";
import type { PgBossService } from "#service.ts";

export const makeService = (client: PgBossClient, names: readonly string[], schema = "pgboss"): PgBossService => ({
	counts: (queue) => countsFor(client, schema, queue.name),
	deadLetteredJobs: deadLetteredJobsFor(client, schema),
	enqueue: (queue, payload, options) =>
		Schema.encodeUnknownEffect(queue.schema)(payload).pipe(
			Effect.mapError(
				(error) =>
					new PgBossPayloadError({
						direction: "encode",
						original: Redacted.make(error),
						queue: queue.name,
					}),
			),
			Effect.flatMap((encoded): Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError> => {
				if (typeof encoded !== "object" || encoded === null) {
					return Effect.fail(
						new PgBossPayloadError({
							direction: "encode",
							original: Redacted.make(new TypeError("pg-boss payloads must encode to objects")),
							queue: queue.name,
						}),
					);
				}
				return capturePayload(encoded).pipe(
					Effect.flatMap((data) =>
						Effect.tryPromise({
							catch: (error) => toPgBossError("enqueue", error, queue.name),
							try: () => client.send(queue.name, data, queue.key === undefined ? options : { ...options, singletonKey: queue.key(payload) }),
						}),
					),
					Effect.map(Option.fromNullishOr),
				);
			}),
		),
	failedJobs: failedJobsFor(client, schema),
	getJob: getJobFor(client),
	health: healthFor(client, names),
	retry: retryFor(client),
});
