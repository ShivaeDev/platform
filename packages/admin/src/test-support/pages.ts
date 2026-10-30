import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query, stream } from "@shivaedev/contract/operation.ts";
import { adminPage } from "#page.ts";
import { JobsPermission, UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";

export const jobs = collection("jobs", Schema.String);
export const Failed = query("failed", { reads: () => [jobs.list], success: Schema.Array(Schema.String) });
export const Retry = command("retry", { invalidates: () => [jobs.list], payload: { id: Schema.String } });
export const Watch = stream("watch", { reads: () => [jobs.list], success: Schema.Array(Schema.String) });
export const JobsContract = contract("admin.jobs", { commands: [Retry], queries: [Failed], streams: [Watch] });
export const Jobs = adminPage({ contract: JobsContract, id: "jobs", permission: JobsPermission, route: { path: "/admin/jobs", title: "Jobs" } });
export const Profile = query("profile", {
	reads: () => [],
	success: Schema.String,
});
export const Users = adminPage({
	contract: contract("admin.users", { queries: [Profile] }),
	id: "users",
	permission: UsersPermission,
	route: { path: "/admin/users", title: "Users" },
});
export const Registry = adminRegistry(Jobs, Users);

const reports = contract("admin.reports", { queries: [Profile] });
export const pagesBesideJobs = {
	"a page that reuses the jobs page's id": adminPage({
		contract: reports,
		id: "jobs",
		permission: UsersPermission,
		route: { path: "/admin/reports", title: "Reports" },
	}),
	"a page that reuses the jobs page's path": adminPage({
		contract: reports,
		id: "reports",
		permission: UsersPermission,
		route: { path: "/admin/jobs", title: "Reports" },
	}),
	"a page that serves the jobs contract again": adminPage({
		contract: JobsContract,
		id: "jobs-again",
		permission: JobsPermission,
		route: { path: "/admin/jobs-again", title: "Jobs again" },
	}),
	"a page whose contract shares only the jobs page's generated subscription": adminPage({
		contract: contract("admin.jobs", { queries: [Profile] }),
		id: "changes",
		permission: JobsPermission,
		route: { path: "/admin/changes", title: "Changes" },
	}),
};
