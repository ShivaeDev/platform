import { authAction } from "@shivaedev/effect-react/client/authAction.ts";
import type { AuthActions } from "#client/auth.ts";

export function screenAuth(): AuthActions {
	function unavailable(): Promise<never> {
		return Promise.reject(new Error("This screen fixture does not provide authentication"));
	}
	return { signOut: authAction(unavailable), submit: authAction(unavailable) };
}
