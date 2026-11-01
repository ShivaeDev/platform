import { Schema } from "effect";

export class MailerError extends Schema.TaggedError<MailerError>()("MailerError", {
	original: Schema.Redacted(Schema.Unknown),
	status: Schema.optionalKey(Schema.Number),
}) {
	override get message() {
		return "Resend could not deliver the email";
	}
}
