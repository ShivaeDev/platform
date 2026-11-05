import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { DashboardConfig } from "./Config.ts";
import { findReport } from "./findReport.ts";
import { listPullRequests } from "./listPullRequests.ts";
import { listReports } from "./listReports.ts";

export const dashboardService = defineService({
	id: "@shivaedev/sql/dashboard/Dashboard",
	initialize: Effect.void,
	methods: () => ({ findReport, listPullRequests, listReports }),
	requires: [SqlClient.SqlClient, DashboardConfig],
});
