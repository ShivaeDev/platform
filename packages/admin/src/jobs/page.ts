import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";
import { type JobsEntry, type JobsPayload, jobsQueue } from "./entry.ts";
import { jobsKeys } from "./keys.ts";
import { deadLetteredSchema, JobsFailures, JobsHealth, jobPage, jobSchema, PageFields, QueueCounts } from "./schemas.ts";

export function jobsPage<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const definitions = queues.map((queue: TQueues[number]) => jobsQueue(queue));
	const Job = Schema.Union(definitions.map((queue) => jobSchema<JobsPayload<TQueues[number]>>(queue)));
	const DeadLettered = Schema.Union(definitions.map((queue) => deadLetteredSchema<JobsPayload<TQueues[number]>>(queue)));
	const page = adminPage({
		contract: contract("admin.jobs", {
			queries: [
				query("health", {
					reads: () => [jobsKeys.health.list],
					rejections: JobsFailures,
					success: JobsHealth,
				}),
				query("counts", {
					payload: { queue: Schema.String },
					reads: ({ queue }) => [jobsKeys.counts.item(queue)],
					rejections: JobsFailures,
					success: QueueCounts,
				}),
				query("failed", {
					payload: { ...PageFields, queue: Schema.String },
					reads: ({ queue }) => [jobsKeys.failed.item(queue)],
					rejections: JobsFailures,
					success: jobPage(Job),
				}),
				query("deadLettered", {
					payload: { ...PageFields, queue: Schema.String },
					reads: ({ queue }) => [jobsKeys.deadLettered.item(queue)],
					rejections: JobsFailures,
					success: jobPage(DeadLettered),
				}),
				query("job", {
					payload: { id: Schema.String, queue: Schema.String },
					reads: ({ queue, id }) => [jobsKeys.job(queue).item(id)],
					rejections: JobsFailures,
					success: Schema.OptionFromNullOr(Job),
				}),
			],
		}),
		id: "jobs",
		permission: JobsPermission,
		route: { path: "/admin/jobs", title: "Jobs" },
	});
	return Object.assign(page, { queues });
}
