import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { adminPage } from "#page.ts";
import { jobsKeys } from "./keys.ts";
import { deadLetteredSchema, JobsFailures, JobsHealth, type JobsQueue, jobPage, jobSchema, PageFields, QueueCounts } from "./schemas.ts";

export function jobsPage<const TQueues extends readonly JobsQueue[]>(...queues: TQueues) {
	const Job = Schema.Union(queues.map((queue: TQueues[number]) => jobSchema<TQueues[number]["schema"]>(queue)));
	const DeadLettered = Schema.Union(queues.map((queue: TQueues[number]) => deadLetteredSchema<TQueues[number]["schema"]>(queue)));
	const page = adminPage({
		contract: contract("admin.jobs", {
			queries: [
				query("health", { reads: () => [jobsKeys.health.list], rejections: JobsFailures, success: JobsHealth }),
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
		route: { path: "/admin/jobs", title: "Jobs" },
	});
	return Object.assign(page, { queues });
}
