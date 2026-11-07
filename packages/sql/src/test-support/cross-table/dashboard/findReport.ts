import { Effect } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { DashboardConfig } from "#test/cross-table/dashboard/Config.ts";
import { PullRequest } from "#test/cross-table/dashboard/pullRequests.ts";
import { ReportedPullRequest } from "#test/cross-table/dashboard/rows.ts";

export const findReport = Effect.fn("Dashboard.findReport")(function* (pullRequestId: typeof PullRequest.fields.id.Type) {
	const sql = yield* SqlClient.SqlClient;
	const tables = yield* DashboardConfig;
	const query = SqlSchema.findOneOption({
		execute: (id) => sql`
			select p.id as "pullRequestId", p.title, p.updated_at as "updatedAt",
			       r.id as "reportId", r.score
			from ${sql(tables.pullRequests)} p
			inner join ${sql(tables.reports)} r on r.pull_request_id = p.id
			where p.id = ${id}`,
		Request: PullRequest.fields.id,
		Result: ReportedPullRequest,
	});
	return yield* query(pullRequestId);
});
