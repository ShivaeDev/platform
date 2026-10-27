import { Effect, Option, Schema } from "effect";
import { jobsKeys } from "@shivaedev/admin/jobs/keys.ts";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { usersPage } from "@shivaedev/admin/users/page.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { ModuleReadPolicies, ReadKeyPolicy } from "@shivaedev/contract/readPolicy.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { IdentityValue } from "@shivaedev/identity/identity.ts";
import { AppAccess } from "#AppAccess.ts";
import { StatisticsPermission } from "#appPermissions.ts";
import { notes } from "./notes.ts";
import { noteQueue } from "./queue.ts";

export const UsersPage = usersPage(AppAccess);
export const JobsPage = jobsPage(noteQueue);
export const NoteStatistics = Schema.Struct({ notes: Schema.Number, pending: Schema.Number, words: Schema.Number });
export const StatisticsPage = adminPage({
	contract: contract("admin.notes", {
		queries: [query("statistics", { reads: () => [notes.list], rejections: { ServiceUnavailable }, success: NoteStatistics })],
	}),
	id: "note-statistics",
	permission: StatisticsPermission,
	route: { path: "/admin/notes", title: "Note statistics" },
});
export const Admin = adminRegistry(JobsPage, StatisticsPage, UsersPage);

const signedIn: ReadKeyPolicy<IdentityValue> = (_key, viewer) => Effect.succeed(Option.isSome(viewer));
export const adminReadPolicies = {
	"admin.users": signedIn,
	[jobsKeys.health.name]: signedIn,
	[jobsKeys.counts.name]: signedIn,
	[jobsKeys.failed.name]: signedIn,
	[jobsKeys.deadLettered.name]: signedIn,
	[jobsKeys.job(noteQueue.name).name]: signedIn,
} satisfies ModuleReadPolicies<IdentityValue>;
