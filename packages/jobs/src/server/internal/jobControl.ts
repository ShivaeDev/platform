import { Effect, Option, Redacted, Schema } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { JobFailure } from "#JobFailure.ts";
import { PgBossPayloadError } from "#server/error.ts";
import { deferralOf } from "#server/internal/deferral.ts";
import { JobEngine } from "#server/internal/engine.ts";
import { decodeStoredData } from "#server/internal/storedRows.ts";
import type { PgBossService } from "#server/service.ts";

const StoredFailure = Schema.Union([JobFailure, Schema.Struct({ value: JobFailure })]);

function decodeFailure(queue: string, output: unknown) {
	return Schema.decodeUnknownEffect(StoredFailure)(output).pipe(
		Effect.map((failure) => ("value" in failure ? failure.value : failure)),
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue })),
	);
}

export const jobControl = Effect.gen(function* () {
	const engine = yield* JobEngine;
	const getJob: PgBossService["getJob"] = (queue, id) =>
		engine.getJob(queue.name, id).pipe(
			Effect.flatMap(
				Effect.fnUntraced(function* (job) {
					if (job === undefined) {
						return Option.none();
					}
					const data = yield* decodeStoredData(queue, job.data);
					const output = job.output === null || deferralOf(job) !== undefined ? job.output : yield* decodeFailure(queue.name, job.output);
					const sourceOutput = job.sourceOutput === null ? null : yield* decodeFailure(queue.name, job.sourceOutput);
					return Option.some({ ...job, data: redact(data), output, sourceOutput });
				}),
			),
		);
	const retry: PgBossService["retry"] = (queue, id) => engine.retry(queue.name, id);
	return { getJob, retry };
});
