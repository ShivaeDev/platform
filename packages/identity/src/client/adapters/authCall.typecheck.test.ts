import type { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { AuthFailure } from "#client/AuthFailure.ts";
import type { AuthFailureCode } from "#client/AuthFailureCode.ts";
import { authCall } from "./authCall.ts";

function run(input: { readonly email: string }, _signal: AbortSignal) {
	return Promise.resolve(
		input.email.length > 0
			? { data: { session: "signed-in" }, error: null }
			: { data: null, error: { code: "INVALID_EMAIL" as const, status: HttpStatus.fromLiteral("Unauthorized") } },
	);
}
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
