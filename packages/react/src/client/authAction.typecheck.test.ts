import type { Cause, Option } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { type AuthActionUnavailable, authAction } from "#client/authAction.ts";
import { useAction } from "#client/resultState.ts";

const signIn = authAction(async (input: { readonly email: string }, _signal) =>
	input.email.length > 0
		? { data: { session: "signed-in" }, error: null }
		: { data: null, error: { code: "INVALID_EMAIL" as const, status: HttpStatus.fromLiteral("Unauthorized") } },
);

export function useSignIn() {
	const action = useAction(signIn);
	const failure: Option.Option<Cause.Cause<{ readonly code: "INVALID_EMAIL"; readonly status: number } | AuthActionUnavailable>> = action.cause;
	const data: Option.Option<{ readonly session: string } | null> = action.data;
	// @ts-expect-error Credentials retain the Better Auth action's input type.
	action.dispatch({ email: 123 });
	// @ts-expect-error An auth failure does not gain an unrelated code.
	const wrong: Option.Option<Cause.Cause<{ readonly code: "UNRELATED" }>> = action.cause;
	void wrong;
	return { data, failure, pending: action.pending };
}
