import { Schema } from "effect";

export class UndeclaredDefaultRole extends Schema.TaggedError<UndeclaredDefaultRole>()("UndeclaredDefaultRole", {
	role: Schema.String,
}) {
	override get message() {
		return `Default user role is not declared by the application: ${JSON.stringify(this.role)}`;
	}
}
