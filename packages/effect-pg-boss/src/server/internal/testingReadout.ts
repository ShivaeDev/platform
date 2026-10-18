import { Effect, Redacted, Schema } from "effect";
import type { FindJobsOptions, PgBoss } from "pg-boss";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";
import { PgBossPayloadError, PgBossTestingError } from "#error.ts";
import { payloadOf } from "#internal/tracing.ts";

export function testingOperation<A>(operation: string, run: () => Promise<A>, queue?: string) {
	return Effect.tryPromise({
		catch: (original) => new PgBossTestingError({ operation, original: Redacted.make(original), queue }),
		try: run,
	});
}

export function testingReadout(client: () => PgBoss) {
	return <TName extends string, TPayload extends JobPayloadSchema>(queue: QueueDefinition<TName, TPayload>, options?: FindJobsOptions) =>
		testingOperation("jobs", () => client().findJobs<unknown>(queue.name, options), queue.name).pipe(
			Effect.flatMap((jobs) =>
				Effect.forEach(jobs, (job) =>
					Schema.decodeUnknownEffect(queue.schema)(payloadOf(job.data)).pipe(
						Effect.mapError((original) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(original), queue: queue.name })),
						Effect.map((data) => ({ ...job, data })),
					),
				),
			),
		);
}
