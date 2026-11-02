import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import { sessionsHandlers } from "@shivaedev/identity/server/better-auth/sessionsHandlers.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { foundation } from "#admin/modules.ts";

const AdminJobs = makePgBoss("app/AdminJobs");

export function foundationRegistration() {
	return {
		...registerAdmin(foundation.admin, {
			jobs: jobsHandlers(foundation.JobsPage, AdminJobs),
			sessions: sessionsHandlers,
			users: usersHandlers(foundation.UsersPage),
		}),
		services: AdminJobs.layer({ jobs: [] }),
	};
}
