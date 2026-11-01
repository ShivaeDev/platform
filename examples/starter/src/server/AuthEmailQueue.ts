import { Config, Effect, Redacted, Schema } from "effect";
import { defineEmailQueue } from "@shivaedev/email/server/defineEmailQueue.ts";

const AuthMessage = Schema.Struct({
	kind: Schema.Literals(["ConfirmAccount", "ApproveEmailChange", "ConfirmNewAddress", "ResetPassword", "AccountAlreadyExists"]),
	to: Schema.String,
	url: Schema.Redacted(Schema.String),
});

const subjects = {
	AccountAlreadyExists: "Sign in to your account",
	ApproveEmailChange: "Approve your email change",
	ConfirmAccount: "Confirm your account",
	ConfirmNewAddress: "Confirm your new email address",
	ResetPassword: "Reset your password",
};

export const AuthEmailQueue = defineEmailQueue(
	AuthMessage,
	(message) =>
		Effect.gen(function* () {
			const from = yield* Config.String("EMAIL_FROM").pipe(Config.withDefault("Starter <onboarding@resend.dev>"));
			const subject = subjects[message.kind];
			const url = Redacted.value(message.url);
			const escaped = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
			return { from, html: `<p><a href="${escaped}">${subject}</a></p>`, subject, text: `${subject}\n\n${url}`, to: message.to };
		}),
	{ name: "identity.auth-emails" },
);
