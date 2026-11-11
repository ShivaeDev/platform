import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { SessionsPage } from "@shivaedev/admin/sessions/Page.ts";
import { UsersPage } from "@shivaedev/admin/users/Page.ts";

export function foundationPages<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const JobsPage = jobsPage(...queues);
	return { admin: adminRegistry(JobsPage, UsersPage, SessionsPage), JobsPage, queues: JobsPage.queues, SessionsPage, UsersPage };
}
