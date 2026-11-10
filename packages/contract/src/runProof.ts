import type { Effect, Option, Schema } from "effect";
import type { InfrastructureFailure } from "@shivaedev/errors/infrastructure.ts";
import type { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";
import type { TaggedRejection } from "#rejection.ts";

export type RunBody<TPayload, TYielded, A> = (payload: TPayload) => Generator<TYielded, A, never>;

export type ErrorOf<TYielded> = [TYielded] extends [never] ? never : [TYielded] extends [Effect.Effect<unknown, infer E, unknown>] ? E : never;
export type ServicesOf<TYielded> = [TYielded] extends [never] ? never : [TYielded] extends [Effect.Effect<unknown, unknown, infer R>] ? R : never;
export type RunEffect<TYielded, A> = [A] extends [unknown] ? Effect.Effect<A, ErrorOf<TYielded>, ServicesOf<TYielded>> : never;

export interface ClassRejections {
	readonly [tag: string]: TaggedRejection;
}

export interface Automatic {
	readonly InternalServerError: typeof InternalServerError;
	readonly ServiceUnavailable: typeof ServiceUnavailable;
}

export type Raised<E> = Exclude<E, InfrastructureFailure | QueryReadDenied | InternalServerError | ServiceUnavailable>;

export interface SuccessDiffersFromRun<TOperation extends string, TRun, TDeclared> {
	readonly operation: TOperation;
	readonly runReturns: TRun;
	readonly successDeclares: TDeclared;
}

export interface ArrayMutabilityDiffers<TOperation extends string, TFix extends string> {
	readonly fix: TFix;
	readonly operation: TOperation;
}

export interface RunFailsOutsideRejections<TOperation extends string, TTags> {
	readonly missingRejections: TTags;
	readonly operation: TOperation;
}

export interface RejectionsRunNeverRaises<TOperation extends string, TTags> {
	readonly neverRaised: TTags;
	readonly operation: TOperation;
}

export interface RejectionAutomatic<TOperation extends string, TTags> {
	readonly automatic: TTags;
	readonly operation: TOperation;
}

export interface RejectionClassDiffers<TOperation extends string, TTags> {
	readonly operation: TOperation;
	readonly raisedClassDiffers: TTags;
}

export interface SuccessClassNotReturned<TOperation extends string, TRun, TClass> {
	readonly operation: TOperation;
	readonly runReturns: TRun;
	readonly successClass: TClass;
}

export interface RunReturnsAny<TOperation extends string, TFix extends string> {
	readonly fix: TFix;
	readonly operation: TOperation;
}

type Tags<E> = E extends { readonly _tag: infer TTag extends string } ? TTag : never;
type Same<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false;
type Identical<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type ReadonlyArrays<T> = T extends readonly (infer TItem)[]
	? readonly ReadonlyArrays<TItem>[]
	: T extends (...args: never) => unknown
		? T
		: T extends object
			? { readonly [TKey in keyof T]: ReadonlyArrays<T[TKey]> }
			: T;

type Fields<TFields, TReturn, TName extends string> = {
	readonly [TKey in keyof TFields]: ClassesNotReturned<TName, TFields[TKey], TKey extends keyof TReturn ? TReturn[TKey] : never>;
}[keyof TFields];

type Elements<TElements extends readonly unknown[], TReturn, TName extends string> = {
	readonly [TIndex in keyof TElements]: ClassesNotReturned<TName, TElements[TIndex], TIndex extends keyof TReturn ? TReturn[TIndex] : never>;
}[number];

type Members<TMembers extends readonly unknown[], TReturn, TName extends string> = {
	readonly [TIndex in keyof TMembers]: TMembers[TIndex] extends Schema.Top
		? ClassesNotReturned<TName, TMembers[TIndex], Extract<TReturn, TMembers[TIndex]["Type"]>>
		: never;
}[number];

// Shapes agree, so TypeScript cannot tell a plain object from a class instance; each position that holds a class must
// carry exactly that class, or encoding it fails.
type ClassesNotReturned<TName extends string, TSchema, TReturn> =
	TSchema extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
		? Identical<TClass, TReturn> extends true
			? never
			: SuccessClassNotReturned<TName, TReturn, TClass>
		: TSchema extends Schema.$Array<infer TItem> | Schema.NonEmptyArray<infer TItem>
			? ClassesNotReturned<TName, TItem, TReturn extends readonly (infer TReturned)[] ? TReturned : never>
			: TSchema extends Schema.mutable<infer TInner> | Schema.optionalKey<infer TInner>
				? ClassesNotReturned<TName, TInner, Exclude<TReturn, undefined>>
				: TSchema extends Schema.Struct<infer TFields>
					? Fields<TFields, TReturn, TName>
					: TSchema extends Schema.Tuple<infer TElements>
						? Elements<TElements, TReturn, TName>
						: TSchema extends Schema.Union<infer TMembers>
							? Members<TMembers, TReturn, TName>
							: TSchema extends Schema.$Record<infer _TKey, infer TValue>
								? ClassesNotReturned<TName, TValue, TReturn[keyof TReturn]>
								: TSchema extends Schema.Option<infer TValue>
									? ClassesNotReturned<TName, TValue, TReturn extends Option.Option<infer TReturned> ? TReturned : never>
									: never;

export type SuccessProblem<TName extends string, TSuccess, TReturn> = TSuccess extends Schema.Top
	? Same<TSuccess["Type"], TReturn> extends true
		? ClassesNotReturned<TName, TSuccess, TReturn>
		: TSuccess extends Schema.Class<infer TClass, infer _TStruct, infer _TInherited>
			? SuccessClassNotReturned<TName, TReturn, TClass>
			: Same<ReadonlyArrays<TSuccess["Type"]>, ReadonlyArrays<TReturn>> extends true
				? ArrayMutabilityDiffers<TName, "return a readonly array, or declare Schema.mutable for a mutable one">
				: SuccessDiffersFromRun<TName, TReturn, TSuccess["Type"]>
	: never;

type Declared<TSpecs> = TSpecs extends ClassRejections ? keyof TSpecs & string : never;
type AutomaticTags = keyof Automatic;

type DifferentClasses<TSpecs, E> = {
	readonly [TTag in Declared<TSpecs>]: TSpecs extends { readonly [TKey in TTag]: new (...args: never) => infer TDeclared }
		? Identical<TDeclared, Extract<Raised<E>, { readonly _tag: TTag }>> extends true
			? never
			: TTag
		: never;
}[Declared<TSpecs>];

export type RejectionProblem<TName extends string, TSpecs, E> = TSpecs extends undefined
	? never
	: [Extract<Declared<TSpecs>, AutomaticTags>] extends [never]
		? [Exclude<Tags<Raised<E>>, Declared<TSpecs>>] extends [never]
			? [Exclude<Declared<TSpecs>, Tags<Raised<E>>>] extends [never]
				? [DifferentClasses<TSpecs, E>] extends [never]
					? never
					: RejectionClassDiffers<TName, DifferentClasses<TSpecs, E>>
				: RejectionsRunNeverRaises<TName, Exclude<Declared<TSpecs>, Tags<Raised<E>>>>
			: RunFailsOutsideRejections<TName, Exclude<Tags<Raised<E>>, Declared<TSpecs>>>
		: RejectionAutomatic<TName, Extract<Declared<TSpecs>, AutomaticTags>>;

type Problems<TName extends string, TSuccess, TSpecs, TReturn, E> = SuccessProblem<TName, TSuccess, TReturn> | RejectionProblem<TName, TSpecs, E>;

export type SuccessSchema<TSuccess> = TSuccess extends Schema.Top ? TSuccess : Schema.Void;
// A mapped type, unlike the Automatic interface, satisfies the index signature of RejectionSpecs.
type Flat<T> = { readonly [TKey in keyof T]: T[TKey] };
export type SpecsOf<TSpecs> = TSpecs extends ClassRejections ? Flat<TSpecs & Automatic> : Flat<Automatic>;

// TypeScript checks the declaration once with run skipped, before it infers run's types; Pending is the default it sees then.
export interface Pending {
	readonly pendingInference: unique symbol;
}

type IsPending<TReturn> = [TReturn] extends [never] ? false : [TReturn] extends [Pending] ? true : false;

export type RunCheck<TName extends string, TSuccess, TSpecs, TReturn, E> =
	IsAny<TReturn> extends true
		? { readonly operationProblem: RunReturnsAny<TName, "decode the value with a schema, or give run's return a type"> }
		: IsPending<TReturn> extends true
			? unknown
			: [Problems<TName, TSuccess, TSpecs, TReturn, E>] extends [never]
				? unknown
				: { readonly operationProblem: Problems<TName, TSuccess, TSpecs, TReturn, E> };
