import { Schema } from "effect";
import { JobFailure } from "@shivaedev/jobs/JobFailure.ts";

export interface JobsQueue {
	readonly name: string;
	readonly schema: Schema.Top & { readonly Type: object; readonly Encoded: object };
}

export class JobsUnavailable extends Schema.TaggedError<JobsUnavailable>()("JobsUnavailable", {
	operation: Schema.String,
}) {}

export class JobsPayloadInvalid extends Schema.TaggedError<JobsPayloadInvalid>()("JobsPayloadInvalid", {
	queue: Schema.String,
}) {}

export class JobsQueueUnregistered extends Schema.TaggedError<JobsQueueUnregistered>()("JobsQueueUnregistered", {
	queue: Schema.String,
}) {}

export const QueueCounts = Schema.Struct({
	activeCount: Schema.Number,
	failedCount: Schema.Number,
	queuedCount: Schema.Number,
	totalCount: Schema.Number,
});

export const QueueHealth = Schema.Struct({
	activeCount: Schema.Number,
	deadLetteredCount: Schema.Number,
	failedCount: Schema.Number,
	name: Schema.String,
	queuedCount: Schema.Number,
	readyCount: Schema.Number,
});

export const JobsHealth = Schema.Struct({
	activeTotal: Schema.Number,
	deadLetteredTotal: Schema.Number,
	failedTotal: Schema.Number,
	jobs: Schema.Array(QueueHealth),
	queuedTotal: Schema.Number,
	readyTotal: Schema.Number,
});

export const JobFields = {
	attempt: Schema.Number,
	completedOn: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
	createdOn: Schema.DateTimeUtcFromString,
	data: Schema.Unknown.annotate({ sensitive: true }),
	id: Schema.String,
	output: Schema.NullOr(JobFailure).annotate({ sensitive: true }),
	queue: Schema.String,
	retryCount: Schema.Number,
	retryLimit: Schema.Number,
	startedOn: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
	state: Schema.Literals(["created", "retry", "active", "completed", "cancelled", "failed"]),
};

export const PageFields = { cursor: Schema.optionalKey(Schema.String), limit: Schema.Number };
