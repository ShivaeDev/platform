import { Effect, Redacted, Schema } from "effect";
import type { Job } from "pg-boss";
import { workerDiagnostics } from "#adapters/workerDiagnostics.ts";
import { jobContext, type QueueWorker } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { payloadOf } from "#internal/tracing.ts";

export function runQueueWorker(worker: QueueWorker, job: Job<unknown>, deadline: number) {
	return Schema.decodeUnknownEffect(Schema.toCodecJson(worker.queue.schema))(payloadOf(job.data)).pipe(
		Effect.mapError(
			(error) =>
				new PgBossPayloadError({
					direction: "decode",
					original: Redacted.make(error),
					queue: worker.queue.name,
				}),
		),
		Effect.flatMap((payload) => worker.handler(payload, jobContext(job, deadline))),
		workerDiagnostics,
	);
}
