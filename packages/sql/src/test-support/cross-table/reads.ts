import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { dashboardService } from "./dashboard.ts";
import { makePullRequests } from "./pullRequests.ts";
import { makeReports } from "./reports.ts";

export const crossTableReads = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const prefix = `platform_dashboard_${crypto.randomUUID().replaceAll("-", "")}`;
	const tables = { pullRequests: `${prefix}_pull_requests`, reports: `${prefix}_reports` };
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tables.reports)}, ${sql(tables.pullRequests)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tables.pullRequests)} (id integer primary key, title text not null, updated_at timestamptz not null)`;
	yield* sql`create table ${sql(tables.reports)} (
		id integer primary key, pull_request_id integer not null unique references ${sql(tables.pullRequests)} (id), score text not null
	)`;
	const pullRequests = yield* makePullRequests(tables.pullRequests);
	const reports = yield* makeReports(tables.reports);
	yield* pullRequests.insertMany([
		{ id: 1, title: "First", "updated_at": DateTime.makeUnsafe("2026-10-25T10:00:00Z") },
		{ id: 2, title: "Unreported", "updated_at": DateTime.makeUnsafe("2026-10-25T11:00:00Z") },
		{ id: 3, title: "Latest", "updated_at": DateTime.makeUnsafe("2026-10-25T12:00:00Z") },
	]);
	yield* reports.insertMany([
		{ id: 10, "pull_request_id": 1, score: 7 },
		{ id: 30, "pull_request_id": 3, score: 9 },
	]);
	const Dashboard = dashboardService(tables);
	const reads = yield* Dashboard.pipe(Effect.provide(Dashboard.layer));
	return { reads, tables };
});
