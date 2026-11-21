import { Schema } from "effect";

export class UnverifiedAdminEmail extends Schema.TaggedError<UnverifiedAdminEmail>()("UnverifiedAdminEmail", {
	email: Schema.String,
}) {
	override get message() {
		return `ADMIN_EMAIL ${this.email} belongs to an account whose address is not verified; verify it or choose another address`;
	}
}
