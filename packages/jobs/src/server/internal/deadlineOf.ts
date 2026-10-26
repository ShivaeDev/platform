import type { Job } from "pg-boss";

export function deadlineOf(job: Job<unknown>): number {
	if (!("startedOn" in job && job.startedOn instanceof Date && Number.isFinite(job.startedOn.getTime()))) {
		throw new TypeError("Worker jobs must include pg-boss startedOn metadata");
	}
	return job.startedOn.getTime() + job.expireInSeconds * 1000;
}
