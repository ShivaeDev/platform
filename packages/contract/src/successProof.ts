import type { Option, Schema } from "effect";

export interface SuccessDiffersFromRun<TOperation extends string, TRun, TDeclared> {
	readonly operation: TOperation;
	readonly runReturns: TRun;
	readonly successDeclares: TDeclared;
}

export interface ArrayMutabilityDiffers<TOperation extends string, TFix extends string> {
	readonly fix: TFix;
	readonly operation: TOperation;
}

export interface SuccessClassNotReturned<TOperation extends string, TRun, TClass> {
	readonly operation: TOperation;
	readonly runReturns: TRun;
	readonly successClass: TClass;
}

type Same<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false;
export type Identical<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
type ReadonlyArrays<T> = T extends readonly (infer TItem)[]
	? readonly ReadonlyArrays<TItem>[]
	: T extends (...args: never) => unknown
		? T
		: T extends object
			? { readonly [TKey in keyof T]: ReadonlyArrays<T[TKey]> }
			: T;

type Fields<TName extends string, TFields, TReturn> = {
	readonly [TKey in keyof TFields]: NotEncodedAsReturned<TName, TFields[TKey], TKey extends keyof TReturn ? TReturn[TKey] : never>;
}[keyof TFields];

type Elements<TName extends string, TElements extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TElements]: NotEncodedAsReturned<TName, TElements[TIndex], TIndex extends keyof TReturn ? TReturn[TIndex] : never>;
}[number];

type Members<TName extends string, TMembers extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Top
		? NotEncodedAsReturned<TName, TMembers[TIndex], Extract<TReturn, TMembers[TIndex]["Type"]>>
		: never;
}[number];

type Matches<TReturn, TMembers extends readonly unknown[]> = true extends {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Top ? (TReturn extends TMembers[TIndex]["Type"] ? true : false) : false;
}[number]
	? true
	: false;

type Covered<TName extends string, TMembers extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Struct<infer TFields>
		? Schema.Struct<TFields>["Type"] extends TReturn
			? { readonly fields: Fields<TName, TFields, TReturn>; readonly type: Schema.Struct<TFields>["Type"] }
			: never
		: never;
}[number];

// A returned member whose discriminant is itself a union extends no single member, so it is compared with the members it covers.
type Unmatched<TName extends string, TMembers extends readonly unknown[], TReturn> = TReturn extends unknown
	? Matches<TReturn, TMembers> extends true
		? never
		: Covered<TName, TMembers, TReturn> extends infer TCovered extends { readonly fields: unknown; readonly type: unknown }
			? [TCovered] extends [never]
				? never
				: TCovered["fields"] | KeysDiffer<TName, TCovered["type"], TReturn>
			: never
	: never;

type InCollection<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Union<infer TMembers>
		? Members<TName, TMembers, TReturn> | Unmatched<TName, TMembers, TReturn>
		: TSchema extends Schema.$Record<infer _TKey, infer TValue>
			? NotEncodedAsReturned<TName, TValue, TReturn[keyof TReturn]>
			: TSchema extends Schema.Option<infer TValue>
				? NotEncodedAsReturned<TName, TValue, TReturn extends Option.Option<infer TReturned> ? TReturned : never>
				: never;

type KeysOf<T> = T extends unknown ? keyof T : never;

// Mutual assignability lets an optional property exist on one side only, and a Struct encodes only the keys it declares.
// A union member that no returned member extends alone has nothing to compare here; Unmatched compares that return.
type KeysDiffer<TName extends string, TType, TReturn> = [TReturn] extends [never]
	? never
	: Same<KeysOf<TType>, KeysOf<TReturn>> extends true
		? never
		: SuccessDiffersFromRun<TName, TReturn, TType>;

type InComposite<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Struct<infer TFields>
		? Fields<TName, TFields, TReturn> | KeysDiffer<TName, Schema.Struct<TFields>["Type"], TReturn>
		: TSchema extends Schema.Tuple<infer TElements>
			? Elements<TName, TElements, TReturn>
			: InCollection<TName, TSchema, TReturn>;

// mutable and optionalKey stay separate checks: matched as one union pattern, an optionalKey field never reached its inner schema.
type InContainer<TName extends string, TSchema, TReturn> = TSchema extends Schema.$Array<infer TItem> | Schema.NonEmptyArray<infer TItem>
	? NotEncodedAsReturned<TName, TItem, TReturn extends readonly (infer TReturned)[] ? TReturned : never>
	: TSchema extends Schema.mutable<infer TInner>
		? NotEncodedAsReturned<TName, TInner, TReturn>
		: TSchema extends Schema.optionalKey<infer TInner>
			? NotEncodedAsReturned<TName, TInner, Exclude<TReturn, undefined>>
			: InComposite<TName, TSchema, TReturn>;

// Shapes agree, yet encoding still depends on what each position holds: a class position must carry exactly that class,
// or encoding it fails, and a struct position must carry exactly its keys, or a key is lost on the wire.
type NotEncodedAsReturned<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
		? Identical<TClass, TReturn> extends true
			? never
			: SuccessClassNotReturned<TName, TReturn, TClass>
		: InContainer<TName, TSchema, TReturn>;

export type SuccessProblem<TName extends string, TSuccess, TReturn> = TSuccess extends Schema.Top
	? Same<TSuccess["Type"], TReturn> extends true
		? NotEncodedAsReturned<TName, TSuccess, TReturn>
		: TSuccess extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
			? SuccessClassNotReturned<TName, TReturn, TClass>
			: Same<ReadonlyArrays<TSuccess["Type"]>, ReadonlyArrays<TReturn>> extends true
				? ArrayMutabilityDiffers<TName, "return a readonly array, or declare Schema.mutable for a mutable one">
				: SuccessDiffersFromRun<TName, TReturn, TSuccess["Type"]>
	: never;
