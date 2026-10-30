import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { usersPage } from "@shivaedev/admin/users/page.ts";
import { AppAccess } from "#AppAccess.ts";

const UsersPage = usersPage(AppAccess);

export function foundationPages<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const JobsPage = jobsPage(...queues);
	return { admin: adminRegistry(JobsPage, UsersPage), JobsPage, queues, UsersPage };
}
