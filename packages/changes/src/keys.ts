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

export interface BucketKey<TName extends string = string> {
	readonly _tag: "Bucket";
	readonly collection: TName;
	readonly field: string;
	readonly value: Identity;
}
export type Key = ListKey | ItemKey | BucketKey;

export const Key = Schema.Union([
	Schema.Struct({
		_tag: Schema.Literal("Bucket"),
		collection: Schema.String,
		field: Schema.String,
		value: Schema.Union([Schema.String, Schema.Number]),
	}),
	Schema.Struct({ _tag: Schema.Literal("List"), collection: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Item"), collection: Schema.String, id: Schema.Union([Schema.String, Schema.Number]) }),
]);

type BucketFields = Readonly<Record<string, Schema.Top & { readonly Type: Identity }>>;
export interface Collection<TName extends string, TId extends Identity, TFields extends BucketFields = Record<never, never>> {
	readonly bucket: { readonly [TField in keyof TFields]: (value: TFields[TField]["Type"]) => BucketKey<TName> };
	readonly item: (id: TId) => ItemKey<TName>;
	readonly list: ListKey<TName>;
	readonly name: TName;
}

export function collection<
	const TName extends string,
	TId extends Schema.Top & { readonly Type: Identity },
	const TFields extends BucketFields = Record<never, never>,
>(name: TName, _id: TId, fields?: TFields): Collection<TName, TId["Type"], TFields>;
export function collection(name: string, _id: Schema.Top, fields: BucketFields = {}) {
	return {
		bucket: Object.fromEntries(
			Object.keys(fields).map((field) => [field, (value: Identity): BucketKey => ({ _tag: "Bucket", collection: name, field, value })]),
		),
		item: (id: Identity): ItemKey => ({ _tag: "Item", collection: name, id }),
		list: { _tag: "List", collection: name },
		name,
	};
}

export interface KeyContext {
	readonly scope: string;
}

function contextual(key: string, context?: KeyContext): string {
	return context === undefined ? key : `${JSON.stringify(["session", context.scope])}:${key}`;
}

function own(key: Key): string {
	switch (key._tag) {
		case "List":
			return key.collection;
		case "Item":
			return `${key.collection}:${key.id}`;
		case "Bucket":
			return JSON.stringify(["bucket", key.collection, key.field, key.value]);
	}
}

export function readKeys(keys: readonly Key[], context?: KeyContext): readonly string[] {
	return [...new Set(keys.flatMap((key) => (key._tag === "Item" ? [own(key), `${key.collection}:*`] : [own(key)])))].map((key) =>
		contextual(key, context),
	);
}

export function invalidationKeys(keys: readonly Key[], context?: KeyContext): readonly string[] {
	return [...new Set(keys.flatMap((key) => (key._tag === "Item" ? [own(key), key.collection] : [own(key)])))].map((key) => contextual(key, context));
}
