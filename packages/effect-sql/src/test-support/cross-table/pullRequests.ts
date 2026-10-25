import { Schema } from "effect";
import { Model } from "effect/schema";
import { makeRepository } from "#repository.ts";

export class PullRequest extends Model.Class<PullRequest>("DashboardPullRequest")({
	id: Schema.Int,
	title: Schema.String,
	"updated_at": Schema.DateTimeUtcFromDate,
}) {}

export function makePullRequests(tableName: string) {
	return makeRepository(PullRequest, { idColumn: "id", spanPrefix: "PullRequests", tableName });
}
