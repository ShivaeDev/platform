import type { Schema } from "effect";

export type Identity = string | number;

export interface ListKey<Name extends string = string> {
	readonly _tag: "List";
	readonly collection: Name;
}

export interface ItemKey<Name extends string = string> {
	readonly _tag: "Item";
	readonly collection: Name;
	readonly id: Identity;
}

export type Key = ListKey | ItemKey;

export interface Collection<Name extends string, Id extends Identity> {
	readonly name: Name;
	readonly list: ListKey<Name>;
	readonly item: (id: Id) => ItemKey<Name>;
}

export const collection = <const Name extends string, Id extends Schema.Top & { readonly Type: Identity }>(
	name: Name,
	_id: Id,
): Collection<Name, Id["Type"]> => ({
	name,
	list: { _tag: "List", collection: name },
	item: (id) => ({ _tag: "Item", collection: name, id }),
});

const own = (key: Key): string => (key._tag === "List" ? key.collection : `${key.collection}:${key.id}`);

export const readKeys = (keys: ReadonlyArray<Key>): ReadonlyArray<string> => [...new Set(keys.map(own))];

export const invalidationKeys = (keys: ReadonlyArray<Key>): ReadonlyArray<string> => [
	...new Set(keys.flatMap((key) => (key._tag === "List" ? [key.collection] : [own(key), key.collection]))),
];
