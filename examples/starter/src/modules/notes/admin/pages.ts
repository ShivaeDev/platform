import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { Statistics } from "#generated/modules/notes/admin/Statistics.ts";
import { StatisticsPermission } from "#modules/notes/admin/StatisticsPermission.ts";

export const StatisticsPage = adminPage({
	contract: Statistics,
	id: "note-statistics",
	permission: StatisticsPermission,
	route: { path: "/admin/notes", title: "Note statistics" },
});
export const Admin = adminRegistry(StatisticsPage);
