import type { Duration } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";

interface Batch {
	readonly active: () => boolean;
	readonly seen: Set<() => void>;
	readonly window: Duration.Input | undefined;
}
export const liveBatches = new WeakMap<Reactivity.Reactivity, Batch>();
export function liveKeys(keys: readonly string[]) {
	return keys.map((key) => `@shivaedev/live:${key}`);
}

export function invalidateLive(reactivity: Reactivity.Reactivity, keys: readonly string[], active: () => boolean, window?: Duration.Input) {
	liveBatches.set(reactivity, { active, seen: new Set(), window });
	try {
		reactivity.invalidateUnsafe(window === undefined ? keys : liveKeys(keys));
	} finally {
		liveBatches.delete(reactivity);
	}
}
