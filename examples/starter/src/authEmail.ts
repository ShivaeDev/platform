import { Schema } from "effect";

export const authEmail = {
	name: "identity.auth-emails",
	schema: Schema.Struct({
		kind: Schema.Literals(["ConfirmAccount", "ApproveEmailChange", "ConfirmNewAddress", "ResetPassword", "AccountAlreadyExists"]),
		to: Schema.String,
		url: Schema.Redacted(Schema.String),
	}),
} as const;
