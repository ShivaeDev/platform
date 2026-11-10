import { Effect, Schema } from "effect";
import { read } from "@shivaedev/github/read.ts";
import { finalJobTiming, JobTiming } from "#ci/jobTiming.ts";

export const QueueJobs = Schema.Struct({ jobs: Schema.Array(JobTiming) });

export const queueJobTimings = Effect.fn("CI.queueJobTimings")(function* (repository: string, runId: string) {
	for (let attempt = 0; ; attempt += 1) {
		const response = yield* read(`/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`, QueueJobs);
		const matched = response.jobs.filter((job) => /^(?:build|tests \(\d+\)|packed consumers \(\d+\))$/u.test(job.name));
		if (matched.length > 0 && matched.every(finalJobTiming)) {
			return response;
		}
		if (attempt === 4) {
			return response;
		}
		yield* Effect.sleep("5 seconds");
	}
});
