import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { JobsPage } from "@shivaedev/admin/jobs/Page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { SessionsPage } from "@shivaedev/admin/sessions/Page.ts";
import { UsersPage } from "@shivaedev/admin/users/Page.ts";

export function foundationPages<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	return { admin: adminRegistry(JobsPage, UsersPage, SessionsPage), JobsPage, queues, SessionsPage, UsersPage };
}
