import { Schema } from "effect";

export class AdminPasswordLength extends Schema.TaggedError<AdminPasswordLength>()("AdminPasswordLength", {
	maximum: Schema.Number,
	minimum: Schema.Number,
}) {
	override get message() {
		return `ADMIN_PASSWORD must be ${this.minimum} to ${this.maximum} characters long`;
	}
}
