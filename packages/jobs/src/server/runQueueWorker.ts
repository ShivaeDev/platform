import { Effect, Redacted, Schema } from "effect";
import { deferralCount } from "#server/adapters/deferralCount.ts";
import { workerDiagnostics } from "#server/adapters/workerDiagnostics.ts";
import { type JobPayloadSchema, jobContext, type QueueWorker } from "#server/definition.ts";
import { PgBossPayloadError } from "#server/error.ts";
import type { WorkerJob } from "#server/job.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { payloadOf } from "#server/tracing.ts";

export const runQueueWorker = Effect.fnUntraced(function* <R>(
	worker: QueueWorker<JobPayloadSchema & { readonly DecodingServices: R }, R>,
	job: WorkerJob<unknown>,
	deadline: number,
) {
	const { client, schema = "pgboss" } = yield* PgBoss;
	return yield* Schema.decodeUnknownEffect(Schema.toCodecJson(worker.queue.schema))(payloadOf(job.data)).pipe(
		Effect.mapError(
			(error) =>
				new PgBossPayloadError({
					direction: "decode",
					original: Redacted.make(error),
					queue: worker.queue.name,
				}),
		),
		Effect.flatMap((payload) =>
			deferralCount(client, schema, job).pipe(Effect.flatMap((count) => worker.handler(payload, jobContext(job, deadline, count)))),
		),
		workerDiagnostics,
	);
});
