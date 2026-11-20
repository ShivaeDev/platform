import { type AuthActionResult, authCall } from "#client/adapters/authCall.ts";

export interface ChangeEmailInput {
	readonly "callbackURL"?: string;
	readonly newEmail: string;
	readonly password: string;
}

export function changeEmail<A, E extends object>(client: {
	readonly changeEmail: (input: ChangeEmailInput, options: { readonly signal: AbortSignal }) => Promise<AuthActionResult<A, E>>;
}) {
	return authCall((input: ChangeEmailInput, signal) => client.changeEmail(input, { signal }));
}
