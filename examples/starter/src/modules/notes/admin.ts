import { Schema } from "effect";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
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
export const Admin = adminRegistry(JobsPage, StatisticsPage);
