import { Predicate } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

const rechecks = new WeakMap<AtomRegistry.AtomRegistry, () => void>();

export function registerSessionRecheck(registry: AtomRegistry.AtomRegistry, recheck: () => void): () => void {
	rechecks.set(registry, recheck);
	return () => {
		rechecks.delete(registry);
	};
}

export async function recheckUnauthorized(registry: AtomRegistry.AtomRegistry, error: unknown, connection = false): Promise<void> {
	if (Predicate.isTagged(error, "Unauthorized") || (connection && Predicate.isTagged(error, "RpcClientError"))) {
		await rechecks.get(registry)?.();
	}
}
