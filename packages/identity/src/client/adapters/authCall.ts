import { Effect, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { identityAuthFailureCode } from "#authRefusal.ts";
import { AuthFailure, type AuthFailureWithCodes } from "#client/AuthFailure.ts";
import { AuthFailureCode } from "#client/AuthFailureCode.ts";

export interface AuthActionResult<A, E> {
	readonly data: A;
	readonly error: E | null;
}

const supportedCode = Schema.is(AuthFailureCode);

function fallbackCode(error: object) {
	return "status" in error && error.status === HttpStatus.fromLiteral("TooManyRequests") ? "RATE_LIMITED" : "UNKNOWN";
}

export function authCall<TInput, A, E extends object = never, TCode extends string = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
	codes: readonly TCode[] = [],
): (input: TInput) => Effect.Effect<A, AuthFailure | AuthFailureWithCodes<TCode>> {
	const ApplicationFailure = AuthFailure.withCodes(codes);
	const applicationCode = Schema.is(Schema.Literals(codes));
	return (input: TInput) =>
		Effect.tryPromise({
			catch: (cause) => new AuthFailure({ cause, code: "UNKNOWN" }),
			try: (signal) => run(input, signal),
		}).pipe(
			Effect.flatMap(({ data, error }) => {
				if (error === null) {
					return Effect.succeed(data);
				}
				const wire = "code" in error ? error.code : undefined;
				const code = identityAuthFailureCode(wire) ?? wire;
				if (supportedCode(code)) {
					return Effect.fail(new AuthFailure({ cause: error, code }));
				}
				if (applicationCode(wire)) {
					return Effect.fail(new ApplicationFailure({ cause: error, code: wire }));
				}
				return Effect.fail(new AuthFailure({ cause: error, code: fallbackCode(error) }));
			}),
		);
}
