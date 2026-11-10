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
	readonly [TKey in keyof TFields]: ClassesNotReturned<TName, TFields[TKey], TKey extends keyof TReturn ? TReturn[TKey] : never>;
}[keyof TFields];

type Elements<TName extends string, TElements extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TElements]: ClassesNotReturned<TName, TElements[TIndex], TIndex extends keyof TReturn ? TReturn[TIndex] : never>;
}[number];

type Members<TName extends string, TMembers extends readonly unknown[], TReturn> = {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Top
		? ClassesNotReturned<TName, TMembers[TIndex], Extract<TReturn, TMembers[TIndex]["Type"]>>
		: never;
}[number];

type InCollection<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Union<infer TMembers>
		? Members<TName, TMembers, TReturn>
		: TSchema extends Schema.$Record<infer _TKey, infer TValue>
			? ClassesNotReturned<TName, TValue, TReturn[keyof TReturn]>
			: TSchema extends Schema.Option<infer TValue>
				? ClassesNotReturned<TName, TValue, TReturn extends Option.Option<infer TReturned> ? TReturned : never>
				: never;

type InComposite<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Struct<infer TFields>
		? Fields<TName, TFields, TReturn>
		: TSchema extends Schema.Tuple<infer TElements>
			? Elements<TName, TElements, TReturn>
			: InCollection<TName, TSchema, TReturn>;

type InContainer<TName extends string, TSchema, TReturn> = TSchema extends Schema.$Array<infer TItem> | Schema.NonEmptyArray<infer TItem>
	? ClassesNotReturned<TName, TItem, TReturn extends readonly (infer TReturned)[] ? TReturned : never>
	: TSchema extends Schema.mutable<infer TInner> | Schema.optionalKey<infer TInner>
		? ClassesNotReturned<TName, TInner, Exclude<TReturn, undefined>>
		: InComposite<TName, TSchema, TReturn>;

// Shapes agree, so TypeScript cannot tell a plain object from a class instance; each position that holds a class must
// carry exactly that class, or encoding it fails.
type ClassesNotReturned<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
		? Identical<TClass, TReturn> extends true
			? never
			: SuccessClassNotReturned<TName, TReturn, TClass>
		: InContainer<TName, TSchema, TReturn>;

export type SuccessProblem<TName extends string, TSuccess, TReturn> = TSuccess extends Schema.Top
	? Same<TSuccess["Type"], TReturn> extends true
		? ClassesNotReturned<TName, TSuccess, TReturn>
		: TSuccess extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
			? SuccessClassNotReturned<TName, TReturn, TClass>
			: Same<ReadonlyArrays<TSuccess["Type"]>, ReadonlyArrays<TReturn>> extends true
				? ArrayMutabilityDiffers<TName, "return a readonly array, or declare Schema.mutable for a mutable one">
				: SuccessDiffersFromRun<TName, TReturn, TSuccess["Type"]>
	: never;
