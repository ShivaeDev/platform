import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import type { JobsEntry } from "#jobs/entry.ts";
import { jobsKeys } from "#jobs/keys.ts";
import { jobsPage } from "#jobs/page.ts";
import { JobsFailures } from "#jobs/schemas.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";

export class JobsNotFailed extends Schema.TaggedError<JobsNotFailed>()("JobsNotFailed", {
	id: Schema.String,
	queue: Schema.String,
}) {}

export function jobsPageWithRetry<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
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
						rejections: { ...JobsFailures, Forbidden, JobsNotFailed },
					}),
					command("runScheduleNow", {
						invalidates: ({ queue }) => [
							jobsKeys.health.list,
							jobsKeys.counts.item(queue),
							jobsKeys.failed.item(queue),
							jobsKeys.deadLettered.item(queue),
						],
						payload: { queue: Schema.String },
						rejections: { ...JobsFailures, Forbidden },
						success: Schema.OptionFromNullOr(Schema.String),
					}),
				],
				queries: page.contract.declaration.queries,
			}),
			id: page.id,
			permission: JobsPermission,
			route: page.route,
		}),
		{ queues, schedules: queues.filter((entry) => !("schema" in entry)) },
	);
}
