import { Schema } from "effect";
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

export const Since = Schema.Struct({ since: PullRequest.fields.updated_at });
