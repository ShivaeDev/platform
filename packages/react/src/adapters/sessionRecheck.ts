import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { isUnauthorized } from "@shivaedev/errors/taxonomy.ts";

const rechecks = new WeakMap<AtomRegistry.AtomRegistry, () => void>();
// A live query's failure reaches the screen both through its result and through the live status, as one error.
const reported = new WeakSet<object>();

export function firstUnauthorized(error: unknown): boolean {
	if (!isUnauthorized(error) || reported.has(error)) {
		return false;
	}
	reported.add(error);
	return true;
}

export function registerSessionRecheck(registry: AtomRegistry.AtomRegistry, recheck: () => void): () => void {
	rechecks.set(registry, recheck);
	return () => {
		rechecks.delete(registry);
	};
}

export async function recheckUnauthorized(registry: AtomRegistry.AtomRegistry, error: unknown): Promise<void> {
	if (firstUnauthorized(error)) {
		await rechecks.get(registry)?.();
	}
}
