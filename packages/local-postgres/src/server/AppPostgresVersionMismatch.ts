import { Schema } from "effect";

export class AppPostgresVersionMismatch extends Schema.TaggedError<AppPostgresVersionMismatch>()("AppPostgresVersionMismatch", {
	dataDirectory: Schema.String,
	expectedMajor: Schema.String,
	observedMajor: Schema.String,
}) {
	override get message() {
		return `PostgreSQL ${this.expectedMajor} cannot open ${this.dataDirectory}: its data belongs to PostgreSQL ${this.observedMajor}.`;
	}
}
