import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

export interface AuthSession<A, E> {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly refresh: Effect.Effect<A, E, AtomRegistry.AtomRegistry>;
}

export function authSession<A, E>(read: Effect.Effect<A, E>): AuthSession<A, E> {
	const atom = Atom.make(read);
	const refresh = Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		registry.refresh(atom);
		return yield* AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
	});
	return { atom, refresh };
}
