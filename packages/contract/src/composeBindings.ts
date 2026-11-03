import { type LiveBound, LiveConnection } from "#automaticLive.ts";

export const ComposedBindings = Symbol.for("@shivaedev/contract/ComposedBindings");

export interface BindingComposition {
	readonly [ComposedBindings]: readonly LiveBound[];
}

export function composeBindings<TClient extends object>(client: TClient, bindings: readonly LiveBound[]): TClient & BindingComposition {
	return { ...client, [ComposedBindings]: bindings };
}

function isComposition(client: object): client is BindingComposition {
	return ComposedBindings in client;
}

export function liveBindings(client: unknown): readonly LiveBound[] {
	if (typeof client !== "object" || client === null) {
		return [];
	}
	if (isComposition(client)) {
		return client[ComposedBindings];
	}
	return [client, ...Object.values(client)].filter(
		(value): value is LiveBound => typeof value === "object" && value !== null && LiveConnection in value,
	);
}
