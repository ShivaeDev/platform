import { Brand, Hash, Option, Schema, SchemaAST } from "effect";

export type Identity = string | number;

export const Composite: unique symbol = Symbol.for("@shivaedev/changes/keys/Composite");

export type CompositeId = Brand.Branded<string, "CompositeId">;
const CompositeId = Brand.nominal<CompositeId>();

export function isBucketSchema(schema: Schema.Constraint): boolean {
	function supported(ast: SchemaAST.AST): boolean {
		switch (ast._tag) {
			case "String":
			case "Number":
			case "TemplateLiteral":
			case "Enum":
			case "Null":
			case "Undefined":
			case "Void":
			case "Never":
				return true;
			case "Literal":
				return typeof ast.literal === "string" || typeof ast.literal === "number";
			case "Union":
				return ast.types.every(supported);
			case "Suspend":
				return supported(SchemaAST.toType(ast.thunk()));
			default:
				return false;
		}
	}
	return supported(SchemaAST.toType(schema.ast));
}

export function compositeId(values: readonly unknown[]): CompositeId {
	return CompositeId(JSON.stringify(values, (_key, value: unknown) => (typeof value === "bigint" ? String(value) : value)));
}

const IdParts = Schema.fromJsonString(Schema.Array(Schema.Unknown));

// A composite id arrives as a plain string, so only its exact compositeId spelling identifies it.
function isCompositeId(id: Identity): boolean {
	if (typeof id !== "string" || !id.startsWith("[")) {
		return false;
	}
	const parts = Schema.decodeUnknownOption(IdParts)(id);
	return Option.isSome(parts) && parts.value.length > 1 && compositeId(parts.value) === id;
}

export function recordKey(name: string, id: unknown): string {
	const identity = typeof id === "string" || typeof id === "number" || typeof id === "bigint" || typeof id === "boolean" ? String(id) : Hash.hash(id);
	return `${name}:${identity}`;
}

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

export type CompositeItemKey<TName extends string = string> = ItemKey<TName> & { readonly [Composite]: true };
export type CompositeBucketKey<TName extends string = string> = BucketKey<TName> & { readonly [Composite]: true };

export function isComposite(key: Key): key is CompositeItemKey | CompositeBucketKey {
	return Composite in key;
}

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
type BucketTuples = Readonly<Record<string, readonly [string, string, ...string[]]>>;
type TupleValues<TFields extends BucketFields, TColumns extends readonly string[]> = {
	readonly [TColumn in TColumns[number]]: TColumn extends keyof TFields ? TFields[TColumn]["Type"] : Identity;
};
export interface Collection<
	TName extends string,
	TId extends Identity,
	TFields extends BucketFields = Record<never, never>,
	TTuples extends BucketTuples = Record<never, never>,
> {
	readonly bucket: { readonly [TField in keyof TFields]: (value: TFields[TField]["Type"]) => BucketKey<TName> } & {
		readonly [TTuple in keyof TTuples]: (values: TupleValues<TFields, TTuples[TTuple]>) => CompositeBucketKey<TName>;
	};
	readonly item: {
		(id: string extends TId ? CompositeId : never): CompositeItemKey<TName>;
		(id: TId): ItemKey<TName>;
	};
	readonly list: ListKey<TName>;
	readonly name: TName;
	readonly tuples: TTuples;
}

export function collection<
	const TName extends string,
	TId extends Schema.Top & { readonly Type: Identity },
	const TFields extends BucketFields = Record<never, never>,
	const TTuples extends BucketTuples & { readonly [TField in keyof TFields]?: never } = Record<never, never>,
>(name: TName, _id: TId, fields?: TFields, tuples?: TTuples): Collection<TName, TId["Type"], TFields, TTuples>;
export function collection(name: string, _id: Schema.Top, fields: BucketFields = {}, tuples: BucketTuples = {}) {
	function bucket(field: string, value: Identity): BucketKey {
		return { _tag: "Bucket", collection: name, field, value };
	}
	return {
		bucket: Object.fromEntries([
			...Object.keys(fields).map((field) => [field, (value: Identity) => bucket(field, value)]),
			...Object.entries(tuples).map(([field, columns]) => [
				field,
				(values: Readonly<Record<string, Identity>>): CompositeBucketKey => ({
					...bucket(field, compositeId(columns.map((column) => String(values[column])))),
					[Composite]: true,
				}),
			]),
		]),
		item: (id: Identity): ItemKey | CompositeItemKey =>
			isCompositeId(id) ? { _tag: "Item", collection: name, id, [Composite]: true } : { _tag: "Item", collection: name, id },
		list: { _tag: "List", collection: name },
		name,
		tuples,
	};
}

function own(key: Key): string {
	switch (key._tag) {
		case "List":
			return key.collection;
		case "Item":
			return recordKey(key.collection, key.id);
		case "Bucket":
			return JSON.stringify(["bucket", key.collection, key.field, key.value]);
	}
}

export function readKeys(keys: readonly Key[]): readonly string[] {
	return [...new Set(keys.flatMap((key) => (key._tag === "List" ? [own(key)] : [own(key), `${key.collection}:*`])))];
}

export function collectionInvalidationKeys(name: string): readonly string[] {
	return [name, `${name}:*`];
}

export function invalidationKeys(keys: readonly Key[]): readonly string[] {
	return [...new Set(keys.flatMap((key) => (key._tag === "Item" ? [own(key), key.collection] : [own(key)])))];
}
