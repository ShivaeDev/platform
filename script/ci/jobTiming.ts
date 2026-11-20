import { Schema } from "effect";

export const JobTiming = Schema.Struct({
	completedAt: Schema.NullOr(Schema.String),
	conclusion: Schema.NullOr(Schema.String),
	name: Schema.String,
	startedAt: Schema.NullOr(Schema.String),
}).pipe(Schema.encodeKeys({ completedAt: "completed_at", startedAt: "started_at" }));

export function finalJobTiming(job: typeof JobTiming.Type): boolean {
	const duration = Date.parse(job.completedAt ?? "") - Date.parse(job.startedAt ?? "");
	return job.conclusion !== null && Number.isFinite(duration) && duration > 0;
}
