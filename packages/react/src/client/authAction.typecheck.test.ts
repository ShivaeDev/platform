import type { Cause, Effect, Option } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { type AuthFailure, type AuthFailureCode, authAction, authCall } from "#client/authAction.ts";
import { useAction } from "#client/resultState.ts";

function run(input: { readonly email: string }, _signal: AbortSignal) {
	return Promise.resolve(
		input.email.length > 0
			? { data: { session: "signed-in" }, error: null }
			: { data: null, error: { code: "INVALID_EMAIL" as const, status: HttpStatus.fromLiteral("Unauthorized") } },
	);
}
const signIn = authAction(run);
const submit = authCall(run);
const call: Effect.Effect<{ readonly session: string } | null, AuthFailure> = submit({ email: "alice@example.com" });
// @ts-expect-error Auth calls retain their input type.
submit({ email: 123 });
// @ts-expect-error Supported failure codes are a closed union.
const unrelated: AuthFailureCode = "UNRELATED";
export function sentences(messages: Record<AuthFailureCode, string>, failure: AuthFailure) {
	return messages[failure.code];
}
void call;
void unrelated;

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
