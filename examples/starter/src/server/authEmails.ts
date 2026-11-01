import { Config, Effect } from "effect";
import type { BetterAuthEmails } from "@shivaedev/identity/server/better-auth/emails.ts";

export const authEmails = Effect.fnUntraced(function* (
	deliver: BetterAuthEmails["deliver"] = (message) => Effect.logInfo("Authentication email", message),
) {
	const origin = yield* Config.URL("PUBLIC_URL").pipe(Config.withDefault(new URL("http://127.0.0.1:5173")));
	const confirm = new URL("/auth/confirm", origin).href;
	return {
		deliver,
		routes: {
			AccountAlreadyExists: new URL("/sign-in", origin).href,
			ApproveEmailChange: confirm,
			ConfirmAccount: confirm,
			ConfirmNewAddress: confirm,
			ResetPassword: new URL("/reset-password", origin).href,
		},
	} satisfies BetterAuthEmails;
});
