import { Effect, Stream } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { querySignals } from "#querySignals.ts";

export function liveAnswers(registry: AtomRegistry.AtomRegistry, name: string, query: Atom.Atom<unknown>) {
	const signals = querySignals(query);
	return {
		answered: Stream.map(AtomRegistry.toStream(registry, signals), (state) => state.completed),
		current: Effect.sync(() => registry.get(signals).completed),
		name,
	};
}
