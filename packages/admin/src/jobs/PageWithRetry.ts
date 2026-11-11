import { JobsWithRetry } from "#generated/JobsWithRetry.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";

export const JobsPageWithRetry = adminPage({
	contract: JobsWithRetry,
	id: "jobs",
	permission: JobsPermission,
	route: { path: "/admin/jobs", title: "Jobs" },
});
