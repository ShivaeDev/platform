import type { AuthActions } from "#client/auth.ts";

export function screenAuth(): AuthActions {
	function unavailable(): Promise<string | undefined> {
		return Promise.reject(new Error("This screen fixture does not provide authentication"));
	}
	return { signOut: unavailable, submit: unavailable };
}
