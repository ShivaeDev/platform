import { Effect } from "effect";
import type { WorkerJob } from "#server/job.ts";

export function deadlineOf(job: WorkerJob<unknown>): number {
	const startedOn = "startedOn" in job && job.startedOn instanceof Date ? job.startedOn : undefined;
	return (startedOn?.getTime() ?? Number.NaN) + job.expireInSeconds * 1000;
}

export function validateDeadline(job: WorkerJob<unknown>): Effect.Effect<void> {
	if (!("startedOn" in job && job.startedOn instanceof Date && Number.isFinite(job.startedOn.getTime()))) {
		return Effect.die(new TypeError("Worker jobs must include pg-boss startedOn metadata"));
	}
	return Effect.void;
}
