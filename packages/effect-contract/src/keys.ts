import { Schema } from "effect";

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

export const Key = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("List"), collection: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Item"), collection: Schema.String, id: Schema.Union([Schema.String, Schema.Number]) }),
]);

export interface Collection<Name extends string, Id extends Identity> {
	readonly item: (id: Id) => ItemKey<Name>;
	readonly list: ListKey<Name>;
	readonly name: Name;
}

export const collection = <const Name extends string, Id extends Schema.Top & { readonly Type: Identity }>(
	name: Name,
	_id: Id,
): Collection<Name, Id["Type"]> => ({
	item: (id) => ({ _tag: "Item", collection: name, id }),
	list: { _tag: "List", collection: name },
	name,
});

function own(key: Key): string {
	return key._tag === "List" ? key.collection : `${key.collection}:${key.id}`;
}

export const readKeys = (keys: readonly Key[]): readonly string[] => [...new Set(keys.map(own))];

export const invalidationKeys = (keys: readonly Key[]): readonly string[] => [
	...new Set(keys.flatMap((key) => (key._tag === "List" ? [key.collection] : [own(key), key.collection]))),
];
