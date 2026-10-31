import type { countingPaths, faultyWatch } from "./faults.ts";
import type { BoardEngine } from "./storyEngine.ts";

export interface ServingObservations {
	fileReads?: number;
	logged?: Array<{ readonly level: string; readonly message: unknown }>;
	notifications?: { readonly changed: (path: string) => import("effect").Effect.Effect<unknown>; readonly watchedPaths: () => string[] };
	paths?: ReturnType<typeof countingPaths>;
	watch?: ReturnType<typeof faultyWatch>;
}

// Serving traits record their instruments per story here, so verbs read the same instrument the trait installed without widening the shared engine.
const observed = new WeakMap<BoardEngine, ServingObservations>();

export function servingObservations(engine: BoardEngine) {
	let observations = observed.get(engine);
	if (!observations) {
		observations = {};
		observed.set(engine, observations);
	}
	return observations;
}
