import type { Effect } from "effect";
import { SqlSchema } from "effect/sql";
import { ReportedPullRequest } from "./dashboardRows.ts";
import type { initializeDashboard } from "./initializeDashboard.ts";
import { PullRequest } from "./pullRequests.ts";

export function findReport({ sql, tables }: Effect.Success<typeof initializeDashboard>) {
	return SqlSchema.findOneOption({
		execute: (id) => sql`
			select p.id as "pullRequestId", p.title, p.updated_at as "updatedAt",
			       r.id as "reportId", r.score
			from ${sql(tables.pullRequests)} p
			inner join ${sql(tables.reports)} r on r.pull_request_id = p.id
			where p.id = ${id}`,
		Request: PullRequest.fields.id,
		Result: ReportedPullRequest,
	});
}
