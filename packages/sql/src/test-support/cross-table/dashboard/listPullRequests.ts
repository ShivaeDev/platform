import { Effect } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { DashboardConfig } from "./Config.ts";
import { PullRequestWithOptionalReport, Since } from "./rows.ts";

export const listPullRequests = Effect.fn("Dashboard.listPullRequests")(function* (request: typeof Since.Type) {
	const sql = yield* SqlClient.SqlClient;
	const tables = yield* DashboardConfig;
	const query = SqlSchema.findAll({
		execute: ({ since }) => sql`
			select p.id as "pullRequestId", p.title, p.updated_at as "updatedAt",
			       r.id as "reportId", r.score
			from ${sql(tables.pullRequests)} p
			left join ${sql(tables.reports)} r on r.pull_request_id = p.id
			where p.updated_at >= ${since}
			order by p.id`,
		Request: Since,
		Result: PullRequestWithOptionalReport,
	});
	return yield* query(request);
});
