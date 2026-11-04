import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { DashboardConfig } from "./DashboardConfig.ts";
import { findReport } from "./findReport.ts";
import { initializeDashboard } from "./initializeDashboard.ts";
import { listPullRequests } from "./listPullRequests.ts";
import { listReports } from "./listReports.ts";

export const Dashboard = defineService({
	id: "@shivaedev/sql/dashboard/Service",
	initialize: initializeDashboard,
	methods: (state) => ({ findReport: findReport(state), listPullRequests: listPullRequests(state), listReports: listReports(state) }),
	requires: [SqlClient.SqlClient, DashboardConfig],
});
