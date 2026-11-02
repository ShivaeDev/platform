import { Effect, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { AuthFailure } from "#client/AuthFailure.ts";
import { AuthFailureCode } from "#client/AuthFailureCode.ts";

export interface AuthActionResult<A, E> {
	readonly data: A;
	readonly error: E | null;
}

const supportedCode = Schema.is(AuthFailureCode);

export function authCall<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): (input: TInput) => Effect.Effect<A, AuthFailure> {
	return (input) =>
		Effect.tryPromise({
			catch: (cause) => new AuthFailure({ cause, code: "UNKNOWN" }),
			try: (signal) => run(input, signal),
		}).pipe(
			Effect.flatMap(({ data, error }) => {
				if (error === null) {
					return Effect.succeed(data);
				}
				if ("code" in error && supportedCode(error.code)) {
					return Effect.fail(new AuthFailure({ cause: error, code: error.code }));
				}
				const code = "status" in error && error.status === HttpStatus.fromLiteral("TooManyRequests") ? "RATE_LIMITED" : "UNKNOWN";
				return Effect.fail(new AuthFailure({ cause: error, code }));
			}),
		);
}
