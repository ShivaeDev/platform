import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { AuthActionResult } from "./authAction.ts";

export function authQuery<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): (input: TInput) => Atom.Atom<AsyncResult.AsyncResult<A, E | AuthUnavailable>> {
	return Atom.family((input: TInput) =>
		Atom.make(
			Effect.tryPromise({
				catch: (cause) => new AuthUnavailable({ message: String(cause) }),
				try: (signal) => run(input, signal),
			}).pipe(Effect.flatMap((result) => (result.error === null ? Effect.succeed(result.data) : Effect.fail(result.error)))),
		),
	);
}
