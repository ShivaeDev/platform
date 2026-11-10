import type { Effect, Schema } from "effect";
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

type Tags<E> = E extends { readonly _tag: infer TTag extends string } ? TTag : never;
type Same<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false;
type ReadonlyArrays<T> = T extends readonly (infer TItem)[]
	? readonly ReadonlyArrays<TItem>[]
	: T extends (...args: never) => unknown
		? T
		: T extends object
			? { readonly [TKey in keyof T]: ReadonlyArrays<T[TKey]> }
			: T;

type SuccessProblem<TName extends string, TSuccess, TReturn> = TSuccess extends Schema.Top
	? Same<TSuccess["Type"], TReturn> extends true
		? never
		: Same<ReadonlyArrays<TSuccess["Type"]>, ReadonlyArrays<TReturn>> extends true
			? ArrayMutabilityDiffers<TName, "return a readonly array, or declare Schema.mutable for a mutable one">
			: SuccessDiffersFromRun<TName, TReturn, TSuccess["Type"]>
	: never;

type Declared<TSpecs> = TSpecs extends ClassRejections ? keyof TSpecs & string : never;
type AutomaticTags = keyof Automatic;

type RejectionProblem<TName extends string, TSpecs, E> = TSpecs extends undefined
	? never
	: [Extract<Declared<TSpecs>, AutomaticTags>] extends [never]
		? [Exclude<Tags<Raised<E>>, Declared<TSpecs>>] extends [never]
			? [Exclude<Declared<TSpecs>, Tags<Raised<E>>>] extends [never]
				? never
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
	IsPending<TReturn> extends true
		? unknown
		: [Problems<TName, TSuccess, TSpecs, TReturn, E>] extends [never]
			? unknown
			: { readonly operationProblem: Problems<TName, TSuccess, TSpecs, TReturn, E> };
