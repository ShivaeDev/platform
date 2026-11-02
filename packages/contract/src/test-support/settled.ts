import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { until } from "@shivaedev/test-story/server/until.ts";
import { querySignals } from "#querySignals.ts";

export function settled<A, E>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	const signals = querySignals(atom);
	return Effect.acquireUseRelease(
		Effect.sync(() => registry.mount(atom)),
		() =>
			until(
				AtomRegistry.toStream(registry, signals).pipe(Stream.mapEffect(() => Effect.sync(() => registry.get(atom)))),
				(result) => !(AsyncResult.isInitial(result) || result.waiting || registry.get(signals).pending) && registry.get(signals).completed > 0,
				{ name: "completed query" },
			),
		(release) => Effect.sync(release),
	);
}
