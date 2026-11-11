import { Jobs } from "#generated/Jobs.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";

export const JobsPage = adminPage({
	contract: Jobs,
	id: "jobs",
	permission: JobsPermission,
	route: { path: "/admin/jobs", title: "Jobs" },
});
