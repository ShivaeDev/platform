import { Layer } from "effect";
import { Jobs } from "@shivaedev/admin/Jobs.ts";
import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { pgBossQueues } from "@shivaedev/admin/server/adapters/pgBossQueues.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { Users } from "@shivaedev/admin/Users.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { Sessions } from "@shivaedev/identity/Sessions.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { foundationPages } from "#admin/foundationPages.ts";

const AdminJobs = makePgBoss("app/AdminJobs");

export function foundationRegistration<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const foundation = foundationPages(...queues);
	return {
		...registerAdmin(foundation.admin, {
			jobs: moduleHandlers(Jobs),
			sessions: moduleHandlers(Sessions),
			users: moduleHandlers(Users),
		}),
		services: pgBossQueues(AdminJobs, ...queues).pipe(Layer.provideMerge(AdminJobs.layer({ jobs: [] }))),
	};
}
