import { Effect } from "effect";
import { jobDurations } from "#ci/shardCount.ts";

export function availableJobDurations(jobs: unknown, name: RegExp, count: number): number[] | undefined {
	try {
		return jobDurations(jobs, name, count);
	} catch (error) {
		Effect.runSync(Effect.logWarning(`Keeping previous timings: ${error instanceof Error ? error.message : String(error)}`));
		return undefined;
	}
}
