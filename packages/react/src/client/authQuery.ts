import type { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

export function authQuery<TInput, A, E>(read: (input: TInput) => Effect.Effect<A, E>): (input: TInput) => Atom.Atom<AsyncResult.AsyncResult<A, E>> {
	return Atom.family((input: TInput) => Atom.make(read(input)));
}
