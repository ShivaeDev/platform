import { Schema } from "effect";
import { JobFailure } from "@shivaedev/jobs/JobFailure.ts";
import { JobFields } from "#jobs/schemas.ts";

export class JobsDeadLetter extends Schema.Class<JobsDeadLetter>("JobsDeadLetter")({
	...JobFields,
	sourceId: Schema.OptionFromNullOr(Schema.String),
	sourceOutput: Schema.NullOr(JobFailure).annotate({ sensitive: true }),
	sourceQueue: Schema.String,
}) {}
