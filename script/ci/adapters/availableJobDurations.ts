import { Effect, Result } from "effect";
import { jobDurations } from "#ci/shardCount.ts";

export const availableJobDurations = Effect.fn("CI.availableJobDurations")(function* (jobs: unknown, name: RegExp, count: number) {
	const durations = jobDurations(jobs, name, count);
	if (Result.isSuccess(durations)) {
		return durations.success;
	}
	yield* Effect.logWarning(`Keeping previous timings: ${durations.failure.message}`);
	return undefined;
});
