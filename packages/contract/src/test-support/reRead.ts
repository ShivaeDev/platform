import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { until } from "@shivaedev/test-story/server/until.ts";
import { querySignals } from "#querySignals.ts";
import { settled } from "./settled.ts";

export interface Mark {
	readonly completed: number;
}

export function markQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>): Mark {
	return { completed: registry.get(querySignals(atom)).completed };
}

export function reRead<A, E>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, mark: Mark | undefined) {
	return until(AtomRegistry.toStream(registry, querySignals(atom)), (state) => state.completed > (mark?.completed ?? 0), {
		name: "completed query refresh",
	}).pipe(Effect.andThen(settled(registry, atom)));
}
