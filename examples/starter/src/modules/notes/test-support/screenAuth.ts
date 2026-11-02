import { authCall } from "@shivaedev/identity/client/adapters/authCall.ts";
import { authAction } from "@shivaedev/react/client/authAction.ts";
import type { AuthActions } from "#client/auth.ts";

export function screenAuth(): AuthActions {
	function unavailable(): Promise<never> {
		return Promise.reject(new Error("This screen fixture does not provide authentication"));
	}
	return { resetPassword: authAction(authCall(unavailable)), signOut: authAction(authCall(unavailable)), submit: authAction(authCall(unavailable)) };
}
