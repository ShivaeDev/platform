import { type Effect, Schema } from "effect";
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
const ApplicationCode = Schema.Literals(["MEMBERS_ONLY", "MAIL_UNAVAILABLE"]);
const applicationSubmit = authCall(run, ApplicationCode.literals);
type ApplicationFailure = Effect.Error<ReturnType<typeof applicationSubmit>>;
export function applicationSentences(messages: Record<AuthFailureCode | typeof ApplicationCode.Type, string>, failure: ApplicationFailure) {
	return messages[failure.code];
}
// @ts-expect-error Application calls still have a closed code union.
const unrelatedApplication: ApplicationFailure["code"] = "UNRELATED";
export function incompleteApplicationSentences(messages: Record<AuthFailureCode, string>) {
	// @ts-expect-error Applications must handle their declared codes as well as identity's codes.
	const incomplete: Record<ApplicationFailure["code"], string> = messages;
	return incomplete;
}
export function sentences(messages: Record<AuthFailureCode, string>, failure: AuthFailure) {
	return messages[failure.code];
}
void call;
void unrelated;
void unrelatedApplication;
