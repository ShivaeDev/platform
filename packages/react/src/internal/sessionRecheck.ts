import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { isUnauthorized } from "@shivaedev/errors/taxonomy.ts";

const rechecks = new WeakMap<AtomRegistry.AtomRegistry, () => void>();

export function registerSessionRecheck(registry: AtomRegistry.AtomRegistry, recheck: () => void): () => void {
	rechecks.set(registry, recheck);
	return () => {
		rechecks.delete(registry);
	};
}

export async function recheckUnauthorized(registry: AtomRegistry.AtomRegistry, error: unknown): Promise<void> {
	if (isUnauthorized(error)) {
		await rechecks.get(registry)?.();
	}
}
