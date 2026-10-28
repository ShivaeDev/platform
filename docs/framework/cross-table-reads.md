# Cross-table reads with native SqlSchema

A dashboard can read tables owned by different repositories without adding joins to either repository. Keep each repository responsible for one table; put the cross-table query in the service of the module that owns the read. Here, the dashboard owns the combined view of pull requests and their reports. The pull-request and report modules still own their models, repositories and writes.

## Compose the models' field schemas

The [pull-request module](../../packages/sql/src/test-support/cross-table/pullRequests.ts) describes `id: Schema.Int`, `title: Schema.String` and `updated_at: Schema.DateTimeUtcFromDate`. The [report module](../../packages/sql/src/test-support/cross-table/reports.ts) describes `id: Schema.Int`, `pull_request_id: Schema.Int` and `score: Schema.NumberFromString.check(Schema.isFinite())`. Each passes its model to `makeRepository` for its own table.

PostgreSQL stores the IDs in `integer` columns, the title and score in `text` columns, and `updated_at` in a UTC `timestamptz` column. Reports have a unique foreign key to a pull request, so a pull request has at most one report. There are no JSON columns. The score codec deliberately makes the stored text a finite number in application code; the timestamp codec turns the driver's `Date` into `DateTime.Utc`.

Use the models' `.fields` schemas for the read result, including their storage codecs. A new standalone schema with handwritten field types would let the read drift from its repositories. For a left join, wrap every selected column from the optional side in `Schema.NullOr`, even if that column is non-nullable in its own table.

## Own the query in the dashboard service

This is the [dashboard service](../../packages/sql/src/test-support/cross-table/dashboard.ts), quoted exactly. The table names are application configuration; the fixture supplies isolated names. Both repositories and this service use the same native `SqlClient`.

```ts
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
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
```

`SqlSchema.findAll` accepts the decoded request, encodes it with `Request`, executes the SQL, then decodes every returned row with `Result`. `Since` takes its codec from `PullRequest.fields.updated_at`: the caller supplies a `DateTime.Utc`, and `execute` receives a `Date`. The `${since}` interpolation binds that encoded value as a SQL parameter. Keep the field codec in the request schema rather than converting the filter to SQL text or binding the decoded `DateTime` object directly.

`listReports` returns only pull requests with a report. Its composed result has numeric `pullRequestId`, `reportId` and `score`, a string `title`, and a UTC `updatedAt`. `listPullRequests` also returns unreported pull requests, with `reportId: null` and `score: null`. Literal aliases in the SQL match the composed result's field names; literal column names follow the migration's snake_case spelling.

`findReport` uses `SqlSchema.findOneOption` with the model's ID schema. It returns `Option.some` with a decoded row when a report exists, and `Option.none` when the join matches nothing. The unique report foreign key makes this a single-row query; `findOneOption` itself does not enforce uniqueness.

Provide the service's layer from the application database layer, then call it from the dashboard module:

```ts
const Dashboard = dashboardService({ pullRequests: "pull_requests", reports: "reports" });
const recentReports = Dashboard.use((dashboard) =>
  dashboard.listReports({ since: DateTime.makeUnsafe("2026-10-25T11:00:00Z") }),
).pipe(Effect.provide(Dashboard.layer));
```

This effect still requires the application's `SqlClient`. Import `DateTime` and `Effect` from `effect`. Authorization and any caller-specific filters belong in this application service.

## Keep the boundary explicit

Column names inside SQL text are not checked at compile time. Neither a composed result schema nor a typed request proves that a SQL identifier exists or that a join condition is correct. PostgreSQL reports statement failures as typed `SqlError`; decoding the result at the boundary fails with typed `SchemaError` when a returned value violates the composed schema. For example, a stored score of `invalid` cannot decode through `Report.fields.score`. Do not cast driver rows to the expected result type: that removes this check.

These reads are proved against real PostgreSQL: matched and unmatched rows, numeric and UTC decoding, the UTC bound encoded as a `Date` parameter, an invalid stored score failing with `SchemaError`, and optional single-row reads. They are an application composition; `sql` adds no API or repository join builder for them. Test your own composed reads against real PostgreSQL too, including a stored value the result schema rejects, because another database's types and driver values prove nothing about PostgreSQL decoding.
