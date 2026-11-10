import { Effect, type Option, type Schema } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Operation, PayloadSchema } from "#operation.ts";
import type { Loose } from "#operationDeclaration.ts";
import type { PermissionReadPolicy } from "#permissionReadPolicy.ts";
import type { QueryServerReads } from "#QueryServerReads.ts";
import type { QueryReadPolicy, Viewer } from "#readPolicy.ts";
import type { MatchingTags, RejectionSpecs } from "#rejection.ts";
import type { ErrorOf, RunBody, RunCheck, RunEffect, ServicesOf, SpecsOf, SuccessSchema } from "#runProof.ts";

export interface ServedQuery<
	TName extends string,
	TPayload extends Schema.Top,
	TSuccess extends Schema.Top,
	TSpecs extends RejectionSpecs,
	TPolicyError,
	TPolicyServices,
	TRun extends Effect.Effect<unknown, unknown, unknown>,
> extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "query";
	readonly readPolicy: QueryReadPolicy<TPayload["Type"], TPolicyError, TPolicyServices>;
	reads: (payload: TPayload["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
	readonly readsCollections?: readonly { readonly name: string }[] | undefined;
	readonly run: (payload: TPayload["Type"]) => TRun;
	readonly serverReads?: QueryServerReads<TPayload["Type"], TPolicyError, TPolicyServices>;
}

export interface ServedCommand<
	TName extends string,
	TPayload extends Schema.Top,
	TSuccess extends Schema.Top,
	TSpecs extends RejectionSpecs,
	TRun extends Effect.Effect<unknown, unknown, unknown>,
> extends Operation<TName, TPayload, TSuccess, TSpecs> {
	invalidates: (payload: TPayload["Type"], result: Effect.Success<TRun>, viewer?: Option.Option<Viewer>) => readonly Key[];
	readonly kind: "command";
	readonly run: (payload: TPayload["Type"]) => TRun;
}

interface RunFields<TPayload extends Schema.Top | Schema.Struct.Fields, TYielded, TReturn, TSuccess, TSpecs> {
	readonly payload?: TPayload;
	readonly rejections?: TSpecs & MatchingTags<NonNullable<TSpecs>>;
	readonly run?: RunBody<PayloadSchema<TPayload>["Type"], TYielded, TReturn>;
	readonly success?: TSuccess;
}

// A run required where its types are inferred makes TypeScript report a declaration without run against default type
// arguments, hiding the declaration's own mistakes; requiring it apart keeps those errors.
export type RunDeclaration<TPayload extends Schema.Top | Schema.Struct.Fields, TYielded, TReturn, TSuccess, TSpecs> = RunFields<
	TPayload,
	TYielded,
	TReturn,
	TSuccess,
	TSpecs
> &
	NoInfer<{ readonly run: RunBody<never, unknown, unknown> }>;

export type CollectionReadPolicy<TCollections, TPayload, E, R> = TCollections extends undefined
	? unknown
	: { readonly readPolicy: PermissionReadPolicy<TPayload, E, R> };

export type RunQueryDeclaration<
	TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields,
	TYielded,
	TReturn,
	TSuccess,
	TSpecs,
	TPolicyError,
	TPolicyServices,
	TReads,
	TCollections,
> = RunDeclaration<TPayload, TYielded, TReturn, TSuccess, TSpecs> &
	CollectionReadPolicy<TCollections, PayloadSchema<TPayload>["Type"], TPolicyError, TPolicyServices> & {
		readonly readPolicy?: QueryReadPolicy<PayloadSchema<TPayload>["Type"], TPolicyError, TPolicyServices>;
		readonly reads: (payload: PayloadSchema<TPayload>["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
		readonly readsCollections?: TCollections;
		readonly serverReads?: (payload: PayloadSchema<TPayload>["Type"], viewer: Option.Option<Viewer>) => TReads;
	} & NoInfer<RunCheck<TName, TSuccess, TSpecs, TReturn, ErrorOf<TYielded> | TPolicyError | ErrorOf<TReads>>>;

// The conditional resolves to ServedQuery itself, so hovers and errors show it rather than this alias.
export type ServedQueryOf<
	TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields,
	TYielded,
	TReturn,
	TSuccess,
	TSpecs,
	TPolicyError,
	TPolicyServices,
	TReads,
> = [TName] extends [string]
	? ServedQuery<
			TName,
			PayloadSchema<TPayload>,
			SuccessSchema<TSuccess>,
			SpecsOf<TSpecs>,
			TPolicyError | ErrorOf<TReads>,
			TPolicyServices | ServicesOf<TReads>,
			RunEffect<TYielded, TReturn>
		>
	: never;

// Object keys are sorted, so invalidates is checked before run and cannot see run's inferred result; a declared success types it.
export interface ResultNeedsDeclaredSuccess {
	readonly declareSuccess: unique symbol;
}

type ResultOf<TSuccess> = TSuccess extends Schema.Top ? TSuccess["Type"] : ResultNeedsDeclaredSuccess;

export type RunCommandDeclaration<
	TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields,
	TYielded,
	TReturn,
	TSuccess,
	TSpecs,
> = RunDeclaration<TPayload, TYielded, TReturn, TSuccess, TSpecs> & {
	readonly invalidates?: (payload: PayloadSchema<TPayload>["Type"], result: ResultOf<TSuccess>, viewer?: Option.Option<Viewer>) => readonly Key[];
} & NoInfer<RunCheck<TName, TSuccess, TSpecs, TReturn, ErrorOf<TYielded>>>;

interface LooseRun extends Loose {
	readonly run?: (payload: never) => Generator<Effect.Effect<unknown, unknown, unknown>, unknown, never>;
}

export interface LooseQuery extends LooseRun {
	readonly readPolicy?: QueryReadPolicy<unknown, unknown, unknown>;
	readonly reads: (payload: unknown, viewer: Option.Option<Viewer>) => readonly Key[];
	readonly readsCollections?: readonly { readonly name: string }[];
	readonly serverReads?: QueryServerReads<unknown, unknown, unknown>;
}

export interface LooseCommand extends LooseRun {
	readonly invalidates?: (payload: unknown, result: unknown, viewer?: Option.Option<Viewer>) => readonly Key[];
}

export function withAutomatic(declaration: LooseRun): Loose {
	return declaration.run === undefined
		? declaration
		: { ...declaration, rejections: { ...declaration.rejections, InternalServerError, ServiceUnavailable } };
}

export function runOf({ run }: LooseRun) {
	return run === undefined ? {} : { run: Effect.fnUntraced(run) };
}
