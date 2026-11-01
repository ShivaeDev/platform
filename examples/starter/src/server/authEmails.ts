import { Config, Effect, Redacted } from "effect";
import type { BetterAuthEmails } from "@shivaedev/identity/server/better-auth/emails.ts";
import { AuthEmailQueue } from "./AuthEmailQueue.ts";

export const authEmails = Effect.fnUntraced(function* () {
	const origin = yield* Config.URL("PUBLIC_URL").pipe(Config.withDefault(new URL("http://127.0.0.1:5173")));
	const jobs = yield* AuthEmailQueue.Jobs;
	const confirm = new URL("/auth/confirm", origin).href;
	return {
		deliver: (message) =>
			jobs
				.enqueue(AuthEmailQueue.queue, {
					kind: message._tag,
					to: message._tag === "ConfirmNewAddress" ? message.newEmail : message.user.email,
					url: Redacted.make(message.url),
				})
				.pipe(
					Effect.asVoid,
					Effect.mapError(() => ({ code: "EMAIL_UNAVAILABLE", message: "Could not queue the authentication email" })),
				),
		routes: {
			AccountAlreadyExists: new URL("/sign-in", origin).href,
			ApproveEmailChange: confirm,
			ConfirmAccount: confirm,
			ConfirmNewAddress: confirm,
			ResetPassword: new URL("/reset-password", origin).href,
		},
	} satisfies BetterAuthEmails;
});
