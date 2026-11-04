import { type Duration, type Effect, Redacted } from "effect";
import type { AuthEmail, BetterAuthEmails } from "#server/better-auth/emails.ts";
import type { emailHost } from "./emailHost.ts";

export interface EmailEngine {
	headers: Headers;
	host?: Effect.Success<ReturnType<typeof emailHost>>;
	second?: Effect.Success<ReturnType<typeof emailHost>>;
	window?: Duration.Input;
	windows?: BetterAuthEmails["windows"];
}

export function emailEngineHost(engine: EmailEngine) {
	if (engine.host === undefined) {
		throw new Error("Email story auth has not started");
	}
	return engine.host;
}

export function requestEmail(
	engine: EmailEngine,
	kind: AuthEmail["_tag"],
	person = "alice",
	replica: "first" | "second" = "first",
): Promise<Response> {
	const selected = replica === "first" ? emailEngineHost(engine) : engine.second;
	if (selected === undefined) {
		throw new Error("The second email mount has not started");
	}
	const { auth, messages } = selected;
	const email = `${person}@example.test`;
	switch (kind) {
		case "ConfirmAccount":
			return auth.api.sendVerificationEmail({ asResponse: true, body: { email } });
		case "ResetPassword":
			return auth.api.requestPasswordReset({ asResponse: true, body: { email } });
		case "ApproveEmailChange":
			return auth.api.changeEmail({ asResponse: true, body: { newEmail: "alice-new@example.test" }, headers: engine.headers });
		case "ConfirmNewAddress": {
			const approval = messages.find((message) => message._tag === "ApproveEmailChange");
			if (approval?._tag !== "ApproveEmailChange") {
				throw new Error("Alice has no email change to approve");
			}
			return auth.api.verifyEmail({ asResponse: true, query: { token: Redacted.value(approval.token) } });
		}
		case "AccountAlreadyExists":
			return auth.api.signUpEmail({ asResponse: true, body: { email, name: person, password: "unused-signup-password" } });
	}
}
