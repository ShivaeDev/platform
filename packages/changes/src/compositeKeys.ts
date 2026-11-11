import { Brand, Option, Schema } from "effect";
import type { BucketKey, Identity, ItemKey, Key } from "#keys.ts";

export const Composite: unique symbol = Symbol.for("@shivaedev/changes/compositeKeys/Composite");

export type CompositeId = Brand.Branded<string, "CompositeId">;
export const CompositeId = Brand.nominal<CompositeId>();

export type CompositeItemKey<TName extends string = string> = ItemKey<TName> & { readonly [Composite]: true };
export type CompositeBucketKey<TName extends string = string> = BucketKey<TName> & { readonly [Composite]: true };

export function isComposite(key: Key): key is CompositeItemKey | CompositeBucketKey {
	return Composite in key;
}

const IdParts = Schema.fromJsonString(Schema.Array(Schema.Unknown));

// A composite id arrives as a plain string, so only its exact compositeId spelling identifies it.
export function isCompositeId(id: Identity): boolean {
	if (typeof id !== "string" || !id.startsWith("[")) {
		return false;
	}
	const parts = Schema.decodeUnknownOption(IdParts)(id);
	return Option.isSome(parts) && parts.value.length > 1 && JSON.stringify(parts.value) === id;
}
