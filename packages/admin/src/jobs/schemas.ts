import { Schema } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
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

export const JobsFailures = { BadRequest, JobsPayloadInvalid, JobsQueueUnregistered, JobsUnavailable };

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
	id: Schema.String,
	output: Schema.NullOr(JobFailure),
	retryCount: Schema.Number,
	retryLimit: Schema.Number,
	startedOn: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
	state: Schema.Literals(["created", "retry", "active", "completed", "cancelled", "failed"]),
};

export const PageFields = { cursor: Schema.optionalKey(Schema.String), limit: Schema.Number };

export function jobSchema<TPayload extends Schema.Top>(queue: { readonly name: string; readonly schema: TPayload }) {
	return Schema.Struct({ ...JobFields, data: queue.schema, queue: Schema.Literal(queue.name) });
}

export function deadLetteredSchema<TPayload extends Schema.Top>(queue: { readonly name: string; readonly schema: TPayload }) {
	const name: string = `${queue.name}-dlq`;
	return Schema.Struct({
		...JobFields,
		data: queue.schema,
		queue: Schema.Literal(name),
		sourceId: Schema.OptionFromNullOr(Schema.String),
		sourceOutput: Schema.NullOr(JobFailure),
	});
}

export function jobPage<TJob extends Schema.Top>(job: TJob) {
	return Schema.Struct({ jobs: Schema.Array(job), next: Schema.OptionFromNullOr(Schema.String) });
}
