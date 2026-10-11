import { Schema } from "effect";

export type Identity = string | number;

export interface ListKey<TName extends string = string> {
	readonly _tag: "List";
	readonly collection: TName;
}

export interface ItemKey<TName extends string = string> {
	readonly _tag: "Item";
	readonly collection: TName;
	readonly id: Identity;
}

export type Key = ListKey | ItemKey;

export const Key = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("List"), collection: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Item"), collection: Schema.String, id: Schema.Union([Schema.String, Schema.Number]) }),
]);

export interface Collection<TName extends string, TId extends Identity> {
	readonly item: (id: TId) => ItemKey<TName>;
	readonly list: ListKey<TName>;
	readonly name: TName;
}

export const collection = <const TName extends string, TId extends Schema.Top & { readonly Type: Identity }>(
	name: TName,
	_id: TId,
): Collection<TName, TId["Type"]> => ({
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
