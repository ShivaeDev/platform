import { Effect, Layer } from "effect";
import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import { sessionsHandlers } from "@shivaedev/identity/server/better-auth/sessionsHandlers.ts";
import { PgBossInspection } from "@shivaedev/jobs/server/inspection.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { foundationPages } from "#admin/foundationPages.ts";

const AdminJobs = makePgBoss("app/AdminJobs");

export function foundationRegistration<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const foundation = foundationPages(...queues);
	return {
		...registerAdmin(foundation.admin, {
			jobs: jobsHandlers(foundation.JobsPage),
			sessions: sessionsHandlers,
			users: usersHandlers(foundation.UsersPage),
		}),
		services: Layer.effect(
			PgBossInspection,
			Effect.flatMap(AdminJobs, (jobs) => jobs.inspection()),
		).pipe(Layer.provideMerge(AdminJobs.layer({ jobs: [] }))),
	};
}
