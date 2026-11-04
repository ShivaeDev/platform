import { type LiveBound, LiveConnection } from "#automaticLive.ts";

export const ComposedBindings = Symbol.for("@shivaedev/contract/ComposedBindings");

export interface BindingComposition {
	readonly [ComposedBindings]: readonly LiveBound[];
}

export function composeBindings<TClient extends object>(client: TClient, bindings: readonly LiveBound[]): TClient & BindingComposition {
	return { ...client, [ComposedBindings]: bindings };
}

function isLiveBound(client: object): client is LiveBound {
	return LiveConnection in client;
}

function isComposition(client: object): client is BindingComposition {
	return ComposedBindings in client;
}

export function liveBindings(client: unknown): readonly LiveBound[] {
	const pending = [client];
	const visited = new Set<object>();
	const bindings: LiveBound[] = [];
	for (const value of pending) {
		if (typeof value !== "object" || value === null || visited.has(value)) {
			continue;
		}
		visited.add(value);
		if (isComposition(value)) {
			pending.push(...value[ComposedBindings]);
		} else {
			if (isLiveBound(value)) {
				bindings.push(value);
			}
			pending.push(...Object.values(value));
		}
	}
	return bindings;
}
