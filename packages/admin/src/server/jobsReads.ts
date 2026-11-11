import { DateTime, Effect, Option, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import type { JobPage } from "@shivaedev/jobs/server/health.ts";
import { readJobFailure } from "@shivaedev/jobs/server/readJobFailure.ts";
import { JobsDeadLetter } from "#jobs/DeadLetter.ts";
import { jobsKeys } from "#jobs/keys.ts";
import { JobsRow } from "#jobs/Row.ts";
import { JobsPayloadInvalid, PageFields } from "#jobs/schemas.ts";
import { RegisteredQueues } from "#server/RegisteredQueues.ts";

export const Health = query("health", {
	reads: () => [jobsKeys.health.list],
	*run() {
		return yield* (yield* RegisteredQueues).health();
	},
});

export const Counts = query("counts", {
	payload: { queue: Schema.String },
	reads: ({ queue }) => [jobsKeys.counts.item(queue)],
	*run({ queue }) {
		return yield* (yield* RegisteredQueues).counts(queue);
	},
});

export const Failed = query("failed", {
	payload: { ...PageFields, queue: Schema.String },
	reads: ({ queue }) => [jobsKeys.failed.item(queue)],
	*run({ queue, ...options }) {
		const page = yield* (yield* RegisteredQueues).failedJobs(queue, options);
		const rows: JobPage<JobsRow> = { jobs: page.jobs.map((job) => new JobsRow(job)), next: page.next };
		return rows;
	},
});

export const DeadLettered = query("deadLettered", {
	payload: { ...PageFields, queue: Schema.String },
	reads: ({ queue }) => [jobsKeys.deadLettered.item(queue)],
	*run({ queue, ...options }) {
		const page = yield* (yield* RegisteredQueues).deadLetteredJobs(queue, options);
		const copies: JobPage<JobsDeadLetter> = { jobs: page.jobs.map((job) => new JobsDeadLetter(job)), next: page.next };
		return copies;
	},
});

export const Detail = query("job", {
	payload: { id: Schema.String, queue: Schema.String },
	reads: ({ queue, id }) => [jobsKeys.job(queue).item(id)],
	*run({ id, queue }) {
		const found = yield* (yield* RegisteredQueues).getJob(queue, id);
		if (Option.isNone(found)) {
			return Option.none<JobsRow>();
		}
		const job = found.value;
		const output = yield* readJobFailure(queue, job.output).pipe(Effect.mapError(() => new JobsPayloadInvalid({ queue })));
		return Option.some(
			new JobsRow({
				attempt: job.startedOn === null ? 0 : job.retryCount + 1,
				completedOn: Option.map(Option.fromNullishOr(job.completedOn), DateTime.makeUnsafe),
				createdOn: DateTime.makeUnsafe(job.createdOn),
				data: job.data,
				id: job.id,
				output,
				queue: job.name,
				retryCount: job.retryCount,
				retryLimit: job.retryLimit,
				startedOn: Option.map(Option.fromNullishOr(job.startedOn), DateTime.makeUnsafe),
				state: job.state,
			}),
		);
	},
});
