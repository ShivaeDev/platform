import type { User } from "better-auth";
import type { Duration, Effect } from "effect";
import type { BetterAuthHookError } from "./databaseHooks.ts";

interface Message {
	readonly url: string;
	readonly user: Pick<User, "id" | "email" | "name">;
}

export type AuthEmail = Message &
	(
		| { readonly _tag: "ConfirmAccount"; readonly token: string }
		| { readonly _tag: "ApproveEmailChange"; readonly token: string; readonly newEmail: string }
		| { readonly _tag: "ConfirmNewAddress"; readonly token: string; readonly newEmail: string }
		| { readonly _tag: "ResetPassword"; readonly token: string }
		| { readonly _tag: "AccountAlreadyExists" }
	);

export interface BetterAuthEmails<R = never> {
	readonly deliver: (message: AuthEmail) => Effect.Effect<void, BetterAuthHookError, R>;
	readonly routes: Readonly<Record<AuthEmail["_tag"], string>>;
	readonly window?: Duration.Input;
}
