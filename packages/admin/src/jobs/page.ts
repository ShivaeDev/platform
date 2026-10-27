import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";
import { jobsKeys } from "./keys.ts";
import { deadLetteredSchema, JobsFailures, JobsHealth, type JobsQueue, jobPage, jobSchema, PageFields, QueueCounts } from "./schemas.ts";

export function jobsPage<const TQueues extends readonly JobsQueue[]>(...queues: TQueues) {
	const Job = Schema.Union(queues.map((queue: TQueues[number]) => jobSchema<TQueues[number]["schema"]>(queue)));
	const DeadLettered = Schema.Union(queues.map((queue: TQueues[number]) => deadLetteredSchema<TQueues[number]["schema"]>(queue)));
	const page = adminPage({
		contract: contract("admin.jobs", {
			queries: [
				query("health", {
					readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, JobsPermission.permission)),
					reads: () => [jobsKeys.health.list],
					rejections: JobsFailures,
					success: JobsHealth,
				}),
				query("counts", {
					payload: { queue: Schema.String },
					readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, JobsPermission.permission)),
					reads: ({ queue }) => [jobsKeys.counts.item(queue)],
					rejections: JobsFailures,
					success: QueueCounts,
				}),
				query("failed", {
					payload: { ...PageFields, queue: Schema.String },
					readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, JobsPermission.permission)),
					reads: ({ queue }) => [jobsKeys.failed.item(queue)],
					rejections: JobsFailures,
					success: jobPage(Job),
				}),
				query("deadLettered", {
					payload: { ...PageFields, queue: Schema.String },
					readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, JobsPermission.permission)),
					reads: ({ queue }) => [jobsKeys.deadLettered.item(queue)],
					rejections: JobsFailures,
					success: jobPage(DeadLettered),
				}),
				query("job", {
					payload: { id: Schema.String, queue: Schema.String },
					readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, JobsPermission.permission)),
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
