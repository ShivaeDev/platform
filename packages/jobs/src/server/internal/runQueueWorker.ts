import { Effect, Redacted, Schema } from "effect";
import type { Job } from "pg-boss";
import { deferralCount } from "#adapters/deferralCount.ts";
import { workerDiagnostics } from "#adapters/workerDiagnostics.ts";
import type { PgBossClient } from "#client.ts";
import { jobContext, type QueueWorker } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { payloadOf } from "#internal/tracing.ts";

export function runQueueWorker(worker: QueueWorker, job: Job<unknown>, deadline: number, client: PgBossClient, schema: string) {
	return Schema.decodeUnknownEffect(Schema.toCodecJson(worker.queue.schema))(payloadOf(job.data)).pipe(
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
}
