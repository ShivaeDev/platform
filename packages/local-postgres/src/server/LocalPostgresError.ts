import { Schema } from "effect";

export class LocalPostgresError extends Schema.TaggedError<LocalPostgresError>()("LocalPostgresError", {
	message: Schema.String,
}) {}
