import { Data, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

export class AuthActionUnavailable extends Data.TaggedError("AuthActionUnavailable")<{
	readonly cause: unknown;
}> {}

export interface AuthActionResult<A, E> {
	readonly data: A;
	readonly error: E | null;
}

export function authAction<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): Atom.AtomResultFn<TInput, A, E | AuthActionUnavailable> {
	return Atom.fn<TInput>()((input) =>
		Effect.tryPromise({
			catch: (cause) => new AuthActionUnavailable({ cause }),
			try: (signal) => run(input, signal),
		}).pipe(Effect.flatMap((result) => (result.error === null ? Effect.succeed(result.data) : Effect.fail(result.error)))),
	);
}
