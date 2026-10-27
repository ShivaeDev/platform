import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";
import { jobsKeys } from "./keys.ts";
import { jobsPage } from "./page.ts";
import { JobsFailures, type JobsQueue } from "./schemas.ts";

export class JobsNotFailed extends Schema.TaggedError<JobsNotFailed>()("JobsNotFailed", {
	id: Schema.String,
	queue: Schema.String,
}) {}

export function jobsPageWithRetry<const TQueues extends readonly JobsQueue[]>(...queues: TQueues) {
	const page = jobsPage(...queues);
	return Object.assign(
		adminPage({
			contract: contract("admin.jobs", {
				commands: [
					command("retry", {
						invalidates: ({ queue, id }) => [
							jobsKeys.health.list,
							jobsKeys.counts.item(queue),
							jobsKeys.failed.item(queue),
							jobsKeys.deadLettered.item(queue),
							jobsKeys.job(queue).item(id),
						],
						payload: { id: Schema.String, queue: Schema.String },
						rejections: { ...JobsFailures, JobsNotFailed },
					}),
				],
				queries: page.contract.declaration.queries,
			}),
			id: page.id,
			permission: JobsPermission,
			route: page.route,
		}),
		{ queues },
	);
}
