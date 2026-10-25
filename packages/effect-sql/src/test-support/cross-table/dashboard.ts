import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { PullRequest } from "./pullRequests.ts";
import { Report } from "./reports.ts";

export const ReportedPullRequest = Schema.Struct({
	pullRequestId: PullRequest.fields.id,
	reportId: Report.fields.id,
	score: Report.fields.score,
	title: PullRequest.fields.title,
	updatedAt: PullRequest.fields.updated_at,
});

export const PullRequestWithOptionalReport = Schema.Struct({
	...ReportedPullRequest.fields,
	reportId: Schema.NullOr(Report.fields.id),
	score: Schema.NullOr(Report.fields.score),
});

const Since = Schema.Struct({ since: PullRequest.fields.updated_at });

export function dashboardService(tables: { pullRequests: string; reports: string }) {
	return defineService({
		id: "dashboard/Service",
		initialize: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const listReports = SqlSchema.findAll({
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
			const listPullRequests = SqlSchema.findAll({
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
			const findReport = SqlSchema.findOneOption({
				execute: (id) => sql`
					select p.id as "pullRequestId", p.title, p.updated_at as "updatedAt",
					       r.id as "reportId", r.score
					from ${sql(tables.pullRequests)} p
					inner join ${sql(tables.reports)} r on r.pull_request_id = p.id
					where p.id = ${id}`,
				Request: PullRequest.fields.id,
				Result: ReportedPullRequest,
			});
			return { findReport, listPullRequests, listReports };
		}),
		methods: (reads) => reads,
		requires: [SqlClient.SqlClient],
	});
}
