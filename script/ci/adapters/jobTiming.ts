import { Schema } from "effect";

const StepTiming = Schema.Struct({
	completedAt: Schema.NullOr(Schema.String),
	conclusion: Schema.NullOr(Schema.String),
	name: Schema.String,
	status: Schema.String,
}).pipe(Schema.encodeKeys({ completedAt: "completed_at" }));

export const JobTiming = Schema.Struct({
	completedAt: Schema.NullOr(Schema.String),
	conclusion: Schema.NullOr(Schema.String),
	name: Schema.String,
	startedAt: Schema.NullOr(Schema.String),
	steps: Schema.Array(StepTiming),
}).pipe(Schema.encodeKeys({ completedAt: "completed_at", startedAt: "started_at" }));

export function jobTiming(job: typeof JobTiming.Type): typeof JobTiming.Type {
	if (job.completedAt !== null || job.conclusion !== null) {
		return job;
	}
	const last = job.steps.at(-1);
	if (
		last?.name !== "Complete job"
		|| last.conclusion !== "success"
		|| last.completedAt === null
		|| !job.steps.every((step) => step.status === "completed" && (step.conclusion === "success" || step.conclusion === "skipped"))
	) {
		return job;
	}
	return { ...job, completedAt: last.completedAt, conclusion: "success" };
}
