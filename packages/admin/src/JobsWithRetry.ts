import { Schema } from "effect";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { adminJobsWire } from "#generated/JobsWithRetry.ts";
import { jobsKeys } from "#jobs/keys.ts";
import { JobsPermission, RetryJobs } from "#permissions.ts";
import { Counts, DeadLettered, Detail, Failed, Health } from "#server/jobsReads.ts";
import { RegisteredQueues } from "#server/RegisteredQueues.ts";

const Retry = command("retry", {
	invalidates: ({ queue, id }) => [
		jobsKeys.health.list,
		jobsKeys.counts.item(queue),
		jobsKeys.failed.item(queue),
		jobsKeys.deadLettered.item(queue),
		jobsKeys.job(queue).item(id),
	],
	payload: { id: Schema.String, queue: Schema.String },
	*run({ id, queue }) {
		yield* requirePermission(yield* SessionUser, RetryJobs);
		yield* (yield* RegisteredQueues).retry(queue, id);
	},
});

const RunScheduleNow = command("runScheduleNow", {
	invalidates: ({ queue }) => [jobsKeys.health.list, jobsKeys.counts.item(queue), jobsKeys.failed.item(queue), jobsKeys.deadLettered.item(queue)],
	payload: { queue: Schema.String },
	*run({ queue }) {
		yield* requirePermission(yield* SessionUser, RetryJobs);
		return yield* (yield* RegisteredQueues).runScheduleNow(queue);
	},
});

export const JobsWithRetry = defineModule({
	middleware: JobsPermission,
	name: "admin.jobs",
	operations: [Health, Counts, Failed, DeadLettered, Detail, Retry, RunScheduleNow],
	requires: [RegisteredQueues],
	wire: adminJobsWire,
});
