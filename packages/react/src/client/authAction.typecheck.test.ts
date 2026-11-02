import type { Cause, Option } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { AuthFailure } from "@shivaedev/identity/client/AuthFailure.ts";
import { authCall } from "@shivaedev/identity/client/adapters/authCall.ts";
import { authAction } from "#client/authAction.ts";
import { useAction } from "#client/resultState.ts";

function run(input: { readonly email: string }, _signal: AbortSignal) {
	return Promise.resolve(
		input.email.length > 0
			? { data: { session: "signed-in" }, error: null }
			: { data: null, error: { code: "INVALID_EMAIL" as const, status: HttpStatus.fromLiteral("Unauthorized") } },
	);
}
const signIn = authAction(authCall(run));
export function useSignIn() {
	const action = useAction(signIn);
	const failure: Option.Option<Cause.Cause<AuthFailure>> = action.cause;
	const data: Option.Option<{ readonly session: string } | null> = action.data;
	// @ts-expect-error Credentials retain the Better Auth action's input type.
	action.dispatch({ email: 123 });
	// @ts-expect-error An auth failure does not gain an unrelated code.
	const wrong: Option.Option<Cause.Cause<{ readonly code: "UNRELATED" }>> = action.cause;
	void wrong;
	return { data, failure, pending: action.pending };
}
