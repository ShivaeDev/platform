import type { Schema } from "effect";
import { Effect, Option } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { deferralOf } from "#server/deferral.ts";
import type { JobPayloadSchema } from "#server/definition.ts";
import { readJobFailure } from "#server/readJobFailure.ts";
import { PgBossOperations } from "#server/services/operations/service.ts";
import { decodeStoredData } from "#server/storedRows.ts";

export const getJob = Effect.fnUntraced(function* <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
	queue: { readonly name: TName; readonly schema: TPayload },
	id: string,
) {
	const engine = yield* PgBossOperations;
	return yield* engine.getJob(queue.name, id).pipe(
		Effect.flatMap(
			Effect.fnUntraced(function* (job) {
				if (job === undefined) {
					return Option.none();
				}
				const data = yield* decodeStoredData(queue, job.data);
				const output = deferralOf(job) === undefined ? yield* readJobFailure(queue.name, job.output) : job.output;
				const sourceOutput = yield* readJobFailure(queue.name, job.sourceOutput);
				return Option.some({ ...job, data: redact(data), output, sourceOutput });
			}),
		),
	);
});
