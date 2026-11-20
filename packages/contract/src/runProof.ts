import type { Effect } from "effect";
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

export interface RunReturnsAny<TOperation extends string, TFix extends string> {
	readonly fix: TFix;
	readonly operation: TOperation;
}

type IsAny<T> = 0 extends 1 & T ? true : false;

// A mapped type, unlike the Automatic interface, satisfies the index signature of RejectionSpecs.
type Flat<T> = { readonly [TKey in keyof T]: T[TKey] };
export type SpecsOf<TSpecs> = TSpecs extends ClassRejections ? Flat<TSpecs & Automatic> : Flat<Automatic>;

export type RunCheck<TName extends string, TReturn> =
	IsAny<TReturn> extends true
		? { readonly operationProblem: RunReturnsAny<TName, "decode the value with a schema, or give run's return a type"> }
		: unknown;
