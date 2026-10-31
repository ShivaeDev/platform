import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { until } from "@shivaedev/test-story/server/until.ts";

function idle<A, E>(result: AsyncResult.AsyncResult<A, E>) {
	return !(AsyncResult.isInitial(result) || result.waiting);
}

export function settled<A, E>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	// An idle value can be followed at once by a queued refresh, so the result counts as settled only if it is still idle when read.
	const stillIdle = AtomRegistry.toStream(registry, atom).pipe(
		Stream.filter(idle),
		Stream.mapEffect(() => Effect.sync(() => registry.get(atom))),
	);
	return until(stillIdle, idle, { name: "settled query result" });
}
