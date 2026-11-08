import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { DashboardConfig } from "#test/cross-table/dashboard/Config.ts";
import { findReport } from "#test/cross-table/dashboard/findReport.ts";
import { listPullRequests } from "#test/cross-table/dashboard/listPullRequests.ts";
import { listReports } from "#test/cross-table/dashboard/listReports.ts";

export const dashboardService = defineService({
	id: "@shivaedev/sql/dashboard/Dashboard",
	initialize: Effect.void,
	methods: () => ({ findReport, listPullRequests, listReports }),
	requires: [SqlClient.SqlClient, DashboardConfig],
});
