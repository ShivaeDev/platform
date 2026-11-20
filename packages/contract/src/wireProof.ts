import type { Option, Schema } from "effect";
import type { ClassRejections, Raised } from "#runProof.ts";

type Same<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false;
type Identical<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;

type Fields<TFields, TReturn> = {
	readonly [TKey in keyof TFields]: NotEncodedAsReturned<TFields[TKey], TKey extends keyof TReturn ? TReturn[TKey] : never>;
}[keyof TFields];

type Elements<TElements extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TElements]: NotEncodedAsReturned<TElements[TIndex], TIndex extends keyof TReturn ? TReturn[TIndex] : never>;
}[number];

type Members<TMembers extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Top
		? NotEncodedAsReturned<TMembers[TIndex], Extract<TReturn, TMembers[TIndex]["Type"]>>
		: never;
}[number];

type Matches<TReturn, TMembers extends readonly unknown[]> = true extends {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Top ? (TReturn extends TMembers[TIndex]["Type"] ? true : false) : false;
}[number]
	? true
	: false;

type Covered<TMembers extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Struct<infer TFields>
		? Schema.Struct<TFields>["Type"] extends TReturn
			? { readonly fields: Fields<TFields, TReturn>; readonly type: Schema.Struct<TFields>["Type"] }
			: never
		: never;
}[number];

// A returned member whose discriminant is itself a union extends no single member, so it is compared with the members it covers.
type Unmatched<TMembers extends readonly unknown[], TReturn> = TReturn extends unknown
	? Matches<TReturn, TMembers> extends true
		? never
		: Covered<TMembers, TReturn> extends infer TCovered extends { readonly fields: unknown; readonly type: unknown }
			? [TCovered] extends [never]
				? never
				: TCovered["fields"] | KeysDiffer<TCovered["type"], TReturn>
			: never
	: never;

type InCollection<TSchema, TReturn> =
	TSchema extends Schema.Union<infer TMembers>
		? Members<TMembers, TReturn> | Unmatched<TMembers, TReturn>
		: TSchema extends Schema.$Record<infer _TKey, infer TValue>
			? NotEncodedAsReturned<TValue, TReturn[keyof TReturn]>
			: TSchema extends Schema.Option<infer TValue>
				? NotEncodedAsReturned<TValue, TReturn extends Option.Option<infer TReturned> ? TReturned : never>
				: never;

type KeysOf<T> = T extends unknown ? keyof T : never;

type KeysDiffer<TType, TReturn> = [TReturn] extends [never] ? never : Same<KeysOf<TType>, KeysOf<TReturn>> extends true ? never : true;

type InComposite<TSchema, TReturn> =
	TSchema extends Schema.Struct<infer TFields>
		? Fields<TFields, TReturn> | KeysDiffer<Schema.Struct<TFields>["Type"], TReturn>
		: TSchema extends Schema.Tuple<infer TElements>
			? Elements<TElements, TReturn>
			: InCollection<TSchema, TReturn>;

type InContainer<TSchema, TReturn> = TSchema extends Schema.$Array<infer TItem> | Schema.NonEmptyArray<infer TItem>
	? NotEncodedAsReturned<TItem, TReturn extends readonly (infer TReturned)[] ? TReturned : never>
	: TSchema extends Schema.mutable<infer TInner>
		? NotEncodedAsReturned<TInner, TReturn>
		: TSchema extends Schema.mutableKey<infer TInner>
			? NotEncodedAsReturned<TInner, TReturn>
			: TSchema extends Schema.optionalKey<infer TInner>
				? NotEncodedAsReturned<TInner, Exclude<TReturn, undefined>>
				: InComposite<TSchema, TReturn>;

// Mutual assignability passed, yet encoding still depends on what each position holds: a class position must carry exactly
// that class, or encoding it fails, and a struct position exactly its keys, since an optional key may sit on one side only.
type NotEncodedAsReturned<TSchema, TReturn> =
	TSchema extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
		? Identical<TClass, TReturn> extends true
			? never
			: true
		: InContainer<TSchema, TReturn>;

export type SuccessDiffers<TSuccess extends Schema.Top, TReturn> =
	Same<TSuccess["Type"], TReturn> extends true ? NotEncodedAsReturned<TSuccess, TReturn> : true;

type Tags<E> = E extends { readonly _tag: infer TTag extends string } ? TTag : never;
type Listed<TSpecs extends ClassRejections> = keyof TSpecs & string;
type AutomaticTags = "InternalServerError" | "ServiceUnavailable";

type DifferentClasses<TSpecs extends ClassRejections, E> = {
	readonly [TTag in Listed<TSpecs>]: TSpecs extends { readonly [TKey in TTag]: new (...args: never) => infer TListed }
		? Identical<TListed, Extract<Raised<E>, { readonly _tag: TTag }>> extends true
			? never
			: TTag
		: never;
}[Listed<TSpecs>];

export type RejectionsDiffer<TSpecs extends ClassRejections, E> = [Extract<Listed<TSpecs>, AutomaticTags>] extends [never]
	? [Exclude<Tags<Raised<E>>, Listed<TSpecs>> | Exclude<Listed<TSpecs>, Tags<Raised<E>>> | DifferentClasses<TSpecs, E>] extends [never]
		? never
		: true
	: true;
