import { Schema } from "effect";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { UsersPage } from "@shivaedev/admin/users/page.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { notes } from "./notes.ts";
import { noteQueue } from "./queue.ts";

export const JobsPage = jobsPage(noteQueue);
export const NoteStatistics = Schema.Struct({ notes: Schema.Number, pending: Schema.Number, words: Schema.Number });
export const StatisticsPage = adminPage({
	contract: contract("admin.notes", {
		queries: [query("statistics", { reads: () => [notes.list], rejections: { ServiceUnavailable }, success: NoteStatistics })],
	}),
	id: "note-statistics",
	route: { path: "/admin/notes", title: "Note statistics" },
});
export const Admin = adminRegistry(JobsPage, StatisticsPage, UsersPage);
