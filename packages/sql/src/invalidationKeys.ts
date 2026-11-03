import { Schema } from "effect";
import { invalidationKeys, Key, recordKey } from "@shivaedev/changes/keys.ts";
import type { InvalidationKeys } from "#transact.ts";

export interface Invalidation {
	readonly key: unknown;
	readonly publication: "local" | "shared";
}

const isKey = Schema.is(Key);

function isList(keys: InvalidationKeys): keys is readonly unknown[] {
	return Array.isArray(keys);
}

export function flatten(keys: InvalidationKeys): readonly unknown[] {
	return isList(keys)
		? keys.flatMap<unknown>((key) => (isKey(key) ? invalidationKeys([key]) : [key]))
		: Object.entries(keys).flatMap(([name, ids]) => [name, ...ids.map((id) => recordKey(name, id))]);
}

export function keysOf(changes: readonly Invalidation[]) {
	return [...new Set(changes.map((change) => change.key))];
}
