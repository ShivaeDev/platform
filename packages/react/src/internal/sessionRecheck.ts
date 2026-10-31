import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { isUnauthorized } from "@shivaedev/errors/taxonomy.ts";

const rechecks = new WeakMap<AtomRegistry.AtomRegistry, () => void>();

export function registerSessionRecheck(registry: AtomRegistry.AtomRegistry, recheck: () => void): () => void {
	rechecks.set(registry, recheck);
	return () => {
		rechecks.delete(registry);
	};
}

export function requestsRecheck(error: unknown, connection = false): boolean {
	return isUnauthorized(error) || (connection && error instanceof RpcClientError);
}

export async function recheckUnauthorized(registry: AtomRegistry.AtomRegistry, error: unknown, connection = false): Promise<void> {
	if (requestsRecheck(error, connection)) {
		await rechecks.get(registry)?.();
	}
}
