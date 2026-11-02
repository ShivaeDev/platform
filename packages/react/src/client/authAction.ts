import type { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

export function authAction<TInput, A, E>(run: (input: TInput) => Effect.Effect<A, E>): Atom.AtomResultFn<TInput, A, E> {
	return Atom.fn<TInput>()(run);
}
