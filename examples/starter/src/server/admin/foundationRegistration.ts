import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import { sessionsHandlers } from "@shivaedev/identity/server/better-auth/sessionsHandlers.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { foundationPages } from "#admin/foundationPages.ts";

const AdminJobs = makePgBoss("app/AdminJobs");

export function foundationRegistration<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const foundation = foundationPages(...queues);
	return {
		...registerAdmin(foundation.admin, {
			jobs: jobsHandlers(foundation.JobsPage, AdminJobs),
			sessions: sessionsHandlers,
			users: usersHandlers(foundation.UsersPage),
		}),
		services: AdminJobs.layer({ jobs: [] }),
	};
}
