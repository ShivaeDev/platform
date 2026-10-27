import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { type AuthActionResult, AuthActionUnavailable } from "./authAction.ts";

export function authQuery<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): (input: TInput) => Atom.Atom<AsyncResult.AsyncResult<A, E | AuthActionUnavailable>> {
	return Atom.family((input: TInput) =>
		Atom.make(
			Effect.tryPromise({
				catch: (cause) => new AuthActionUnavailable({ cause }),
				try: (signal) => run(input, signal),
			}).pipe(Effect.flatMap((result) => (result.error === null ? Effect.succeed(result.data) : Effect.fail(result.error)))),
		),
	);
}
