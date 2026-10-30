import { resolve } from "node:path";
import { Effect, Layer, Redacted } from "effect";
import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { AppAccess } from "#AppAccess.ts";
import { foundation } from "#modules.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";

const AdminJobs = makePgBoss("app/AdminJobs");

export function foundationRegistration(queues: readonly QueueDefinition[]) {
	return {
		...registerAdmin(foundation.admin, {
			jobs: jobsHandlers(foundation.JobsPage, AdminJobs),
			users: usersHandlers(foundation.UsersPage, AppAccess),
		}),
		migrations: resolve(import.meta.dirname, "migrations"),
		services: (url: Redacted.Redacted<string>, max?: number, clientCacheKey?: symbol) =>
			Layer.unwrap(
				Effect.map(JobsClientFactory, (clientFactory) =>
					AdminJobs.layer({
						clientFactory,
						...(clientCacheKey === undefined ? {} : { clientCacheKey }),
						connectionString: Redacted.value(url),
						jobs: queues,
						...(max === undefined ? {} : { max }),
						migrate: false,
					}),
				),
			),
	};
}
