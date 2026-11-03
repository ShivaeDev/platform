import { Effect, Redacted } from "effect";
import type { JobReadOptions } from "#server/client.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import type { EngineClient } from "#server/engineClient.ts";
import type { PgBossPayloadError } from "#server/error.ts";
import { PgBossTestingError } from "#server/error.ts";
import { decodeStoredData } from "#server/internal/storedRows.ts";
import type { Job } from "#server/job.ts";

export function testingOperation<A>(operation: string, run: () => Promise<A>, queue?: string) {
	return Effect.tryPromise({
		catch: (original) => new PgBossTestingError({ operation, original: Redacted.make(original), queue }),
		try: run,
	});
}

export function testingReadout(client: () => EngineClient) {
	return <TName extends string, TPayload extends JobPayloadSchema>(
		queue: QueueDefinition<TName, TPayload>,
		options?: JobReadOptions,
	): Effect.Effect<Job<TPayload["Type"]>[], PgBossTestingError | PgBossPayloadError, TPayload["DecodingServices"]> =>
		testingOperation("jobs", () => client().findJobs<unknown>(queue.name, options), queue.name).pipe(
			Effect.flatMap((jobs) => Effect.forEach(jobs, (job) => decodeStoredData(queue, job.data).pipe(Effect.map((data) => ({ ...job, data }))))),
		);
}
