import { Effect } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { DashboardConfig } from "#test/cross-table/dashboard/Config.ts";
import { ReportedPullRequest, Since } from "#test/cross-table/dashboard/rows.ts";

export const listReports = Effect.fn("Dashboard.listReports")(function* (request: typeof Since.Type) {
	const sql = yield* SqlClient.SqlClient;
	const tables = yield* DashboardConfig;
	const query = SqlSchema.findAll({
		execute: ({ since }) => sql`
			select p.id as "pullRequestId", p.title, p.updated_at as "updatedAt",
			       r.id as "reportId", r.score
			from ${sql(tables.pullRequests)} p
			inner join ${sql(tables.reports)} r on r.pull_request_id = p.id
			where p.updated_at >= ${since}
			order by p.id`,
		Request: Since,
		Result: ReportedPullRequest,
	});
	return yield* query(request);
});
