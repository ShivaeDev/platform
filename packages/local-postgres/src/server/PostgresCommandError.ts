import { Schema } from "effect";

export class PostgresCommandError extends Schema.TaggedError<PostgresCommandError>()("PostgresCommandError", {
	cause: Schema.optional(Schema.Unknown),
	command: Schema.String,
	exitCode: Schema.optional(Schema.Number),
	message: Schema.String,
}) {}
