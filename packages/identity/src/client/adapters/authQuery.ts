import { Effect } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { AuthActionResult } from "#client/adapters/authCall.ts";

export function authQuery<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): (input: TInput) => Effect.Effect<A, E | AuthUnavailable> {
	return (input) =>
		Effect.tryPromise({
			catch: (cause) => new AuthUnavailable({ message: String(cause) }),
			try: (signal) => run(input, signal),
		}).pipe(Effect.flatMap((result) => (result.error === null ? Effect.succeed(result.data) : Effect.fail(result.error))));
}
