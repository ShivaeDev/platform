import type { Effect } from "effect";
import { SqlSchema } from "effect/sql";
import { PullRequestWithOptionalReport, Since } from "./dashboardRows.ts";
import type { initializeDashboard } from "./initializeDashboard.ts";

export function listPullRequests({ sql, tables }: Effect.Success<typeof initializeDashboard>) {
	return SqlSchema.findAll({
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
}
