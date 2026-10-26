import { Schema } from "effect";
import { Model } from "effect/schema";
import { makeRepository } from "#repository.ts";

export class Report extends Model.Class<Report>("DashboardReport")({
	id: Schema.Int,
	"pull_request_id": Schema.Int,
	score: Schema.NumberFromString.check(Schema.isFinite()),
}) {}

export function makeReports(tableName: string) {
	return makeRepository(Report, { idColumn: "id", spanPrefix: "Reports", tableName });
}
