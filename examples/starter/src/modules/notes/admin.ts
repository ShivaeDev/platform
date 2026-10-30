import { Effect, Schema } from "effect";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { StatisticsPermission } from "#appPermissions.ts";
import { notes } from "./notes.ts";

export const NoteStatistics = Schema.Struct({ notes: Schema.Number, pending: Schema.Number, words: Schema.Number });
export const StatisticsPage = adminPage({
	contract: contract("admin.notes", {
		queries: [
			query("statistics", {
				readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, StatisticsPermission.permission)),
				reads: () => [notes.list],
				rejections: { InternalServerError, ServiceUnavailable },
				success: NoteStatistics,
			}),
		],
	}),
	id: "note-statistics",
	permission: StatisticsPermission,
	route: { path: "/admin/notes", title: "Note statistics" },
});
export const Admin = adminRegistry(StatisticsPage);
