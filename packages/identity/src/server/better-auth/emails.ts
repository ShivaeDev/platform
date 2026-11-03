import type { User } from "better-auth";
import type { Duration, Effect, Redacted } from "effect";
import type { BetterAuthHookError } from "./databaseHooks.ts";

interface Message {
	readonly url: Redacted.Redacted<string>;
	readonly user: Pick<User, "id" | "email" | "name">;
}

export type AuthEmail = Message &
	(
		| { readonly _tag: "ConfirmAccount"; readonly token: Redacted.Redacted<string> }
		| { readonly _tag: "ApproveEmailChange"; readonly token: Redacted.Redacted<string>; readonly newEmail: string }
		| { readonly _tag: "ConfirmNewAddress"; readonly token: Redacted.Redacted<string>; readonly newEmail: string }
		| { readonly _tag: "ResetPassword"; readonly token: Redacted.Redacted<string> }
		| { readonly _tag: "AccountAlreadyExists" }
	);

export interface BetterAuthEmails<R = never> {
	readonly deliver: (message: AuthEmail) => Effect.Effect<void, BetterAuthHookError, R>;
	readonly routes: Readonly<Record<AuthEmail["_tag"], string>>;
	readonly window?: Duration.Input;
}
