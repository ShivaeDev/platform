import { invalidationKeys, type Key, readKeys } from "@shivaedev/changes/keys.ts";

export interface KeyContext {
	readonly scope: string;
}

function contextual(keys: readonly string[], context?: KeyContext): readonly string[] {
	return context === undefined ? keys : keys.map((key) => `${JSON.stringify(["session", context.scope])}:${key}`);
}

export function clientReadKeys(keys: readonly Key[], context?: KeyContext): readonly string[] {
	return contextual(readKeys(keys), context);
}

export function clientInvalidationKeys(keys: readonly Key[], context?: KeyContext): readonly string[] {
	return contextual(invalidationKeys(keys), context);
}
