import type { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

export function screenSync<E, R, TRuntimeError>(
	client: { readonly runtime: Atom.AtomRuntime<R, TRuntimeError>; readonly sync: Effect.Effect<void, E, R> },
	registry: AtomRegistry.AtomRegistry,
) {
	return AtomRegistry.getResult(registry, client.runtime.atom(client.sync).pipe(Atom.setIdleTTL(0)));
}
