import type { WorkerJob } from "#server/job.ts";

export function deadlineOf(job: WorkerJob<unknown>): number {
	if (!("startedOn" in job && job.startedOn instanceof Date && Number.isFinite(job.startedOn.getTime()))) {
		throw new TypeError("Worker jobs must include pg-boss startedOn metadata");
	}
	return job.startedOn.getTime() + job.expireInSeconds * 1000;
}
