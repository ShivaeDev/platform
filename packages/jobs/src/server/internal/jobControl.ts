import { Effect, Option } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { deferralOf } from "#server/internal/deferral.ts";
import { JobEngine } from "#server/internal/engine.ts";
import { decodeStoredData } from "#server/internal/storedRows.ts";
import { readJobFailure } from "#server/readJobFailure.ts";
import type { PgBossService } from "#server/service.ts";

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
					const output = deferralOf(job) === undefined ? yield* readJobFailure(queue.name, job.output) : job.output;
					const sourceOutput = yield* readJobFailure(queue.name, job.sourceOutput);
					return Option.some({ ...job, data: redact(data), output, sourceOutput });
				}),
			),
		);
	const retry: PgBossService["retry"] = (queue, id) => engine.retry(queue.name, id);
	return { getJob, retry };
});
