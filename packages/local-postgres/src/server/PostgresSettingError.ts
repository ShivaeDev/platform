import { Schema } from "effect";

export class PostgresSettingError extends Schema.TaggedError<PostgresSettingError>()("PostgresSettingError", {
	cause: Schema.Unknown,
	container: Schema.Literal("development-postgres"),
	setting: Schema.Literal("max_connections"),
}) {
	override get message() {
		return "Could not set max_connections to at least 500 in container development-postgres.";
	}
}
