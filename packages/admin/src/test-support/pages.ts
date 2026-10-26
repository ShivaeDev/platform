import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/contract/keys.ts";
import { command, query, stream } from "@shivaedev/contract/operation.ts";
import { adminPage } from "#page.ts";
import { adminRegistry } from "#registry.ts";

export const jobs = collection("jobs", Schema.String);
export const Failed = query("failed", { reads: () => [jobs.list], success: Schema.Array(Schema.String) });
export const Retry = command("retry", { invalidates: () => [jobs.list], payload: { id: Schema.String } });
export const Watch = stream("watch", { reads: () => [jobs.list], success: Schema.Array(Schema.String) });
export const JobsContract = contract("admin.jobs", { commands: [Retry], queries: [Failed], streams: [Watch] });
export const Jobs = adminPage({ contract: JobsContract, id: "jobs", route: { path: "/admin/jobs", title: "Jobs" } });
export const Profile = query("profile", { reads: () => [], success: Schema.String });
export const Users = adminPage({
	contract: contract("admin.users", { queries: [Profile] }),
	id: "users",
	route: { path: "/admin/users", title: "Users" },
});
export const Registry = adminRegistry(Jobs, Users);
export const ChangesCollision = adminPage({
	contract: contract("admin.jobs", { queries: [Profile] }),
	id: "changes",
	route: { path: "/admin/changes", title: "Changes" },
});
