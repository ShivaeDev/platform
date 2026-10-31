import { Schema } from "effect";

export class PostgresVersionMismatch extends Schema.TaggedError<PostgresVersionMismatch>()("PostgresVersionMismatch", {
	expectedVersion: Schema.Literal("18.6"),
	observedVersion: Schema.String,
}) {
	override get message() {
		return "Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.";
	}
}
