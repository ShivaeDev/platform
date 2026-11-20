import { Effect, type Option, type Schema } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Operation, PayloadSchema } from "#operation.ts";
import type { Loose } from "#operationDeclaration.ts";
import type { PermissionReadPolicy } from "#permissionReadPolicy.ts";
import type { QueryServerReads } from "#QueryServerReads.ts";
import type { QueryReadPolicy, Viewer } from "#readPolicy.ts";
import type { RejectionSpecs } from "#rejection.ts";
import type { ErrorOf, RunBody, RunCheck, RunEffect, ServicesOf, SpecsOf } from "#runProof.ts";

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

interface RunFields<TPayload extends Schema.Top | Schema.Struct.Fields, TYielded, TReturn> {
	readonly payload?: TPayload;
	readonly run?: RunBody<PayloadSchema<TPayload>["Type"], TYielded, TReturn>;
}

// A run required where its types are inferred makes TypeScript report a declaration without run against default type
// arguments, hiding the declaration's own mistakes; requiring it apart keeps those errors.
export type RunDeclaration<TPayload extends Schema.Top | Schema.Struct.Fields, TYielded, TReturn> = RunFields<TPayload, TYielded, TReturn> &
	NoInfer<{ readonly run: RunBody<never, unknown, unknown> }>;

export type CollectionReadPolicy<TCollections, TPayload, E, R> = TCollections extends undefined
	? unknown
	: { readonly readPolicy: PermissionReadPolicy<TPayload, E, R> };

export type RunQueryDeclaration<
	TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields,
	TYielded,
	TReturn,
	TPolicyError,
	TPolicyServices,
	TReads,
	TCollections,
> = RunDeclaration<TPayload, TYielded, TReturn> &
	CollectionReadPolicy<TCollections, PayloadSchema<TPayload>["Type"], TPolicyError, TPolicyServices> & {
		readonly readPolicy?: QueryReadPolicy<PayloadSchema<TPayload>["Type"], TPolicyError, TPolicyServices>;
		readonly reads?: (payload: PayloadSchema<TPayload>["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
		readonly readsCollections?: TCollections;
		readonly serverReads?: (payload: PayloadSchema<TPayload>["Type"], viewer: Option.Option<Viewer>) => TReads;
	} & NoInfer<RunCheck<TName, TReturn>>;

export type ServedQueryOf<
	TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields,
	TYielded,
	TReturn,
	TPolicyError,
	TPolicyServices,
	TReads,
> = [TName] extends [string]
	? ServedQuery<
			TName,
			PayloadSchema<TPayload>,
			Schema.Void,
			SpecsOf<undefined>,
			TPolicyError | ErrorOf<TReads>,
			TPolicyServices | ServicesOf<TReads>,
			RunEffect<TYielded, TReturn>
		>
	: never;

export type ServedCommandOf<TName extends string, TPayload extends Schema.Top | Schema.Struct.Fields, TYielded, TReturn> = ServedCommand<
	TName,
	PayloadSchema<TPayload>,
	Schema.Void,
	SpecsOf<undefined>,
	RunEffect<TYielded, TReturn>
>;

// Object keys are sorted, so invalidates is checked before run and cannot see its result: it is called without one, and
// keys computed from the result are contributed inside run with commandResult.
export type RunCommandDeclaration<TName extends string, TPayload extends Schema.Top | Schema.Struct.Fields, TYielded, TReturn> = RunDeclaration<
	TPayload,
	TYielded,
	TReturn
> & {
	readonly invalidates?: (payload: PayloadSchema<TPayload>["Type"], viewer?: Option.Option<Viewer>) => readonly Key[];
} & NoInfer<RunCheck<TName, TReturn>>;

type RunGenerator = (payload: never) => Generator<Effect.Effect<unknown, unknown, unknown>, unknown, never>;

export interface LooseQuery extends Loose {
	readonly readPolicy?: QueryReadPolicy<unknown, unknown, unknown>;
	readonly reads?: (payload: unknown, viewer: Option.Option<Viewer>) => readonly Key[];
	readonly readsCollections?: readonly { readonly name: string }[];
	readonly run?: RunGenerator;
	readonly serverReads?: QueryServerReads<unknown, unknown, unknown>;
}

type Invalidates = (payload: unknown, result: unknown, viewer?: Option.Option<Viewer>) => readonly Key[];

export type LooseCommand =
	| (Loose & { readonly invalidates?: Invalidates; readonly run?: undefined })
	| {
			readonly invalidates?: (payload: unknown, viewer?: Option.Option<Viewer>) => readonly Key[];
			readonly payload?: Schema.Top | Schema.Struct.Fields;
			readonly run: RunGenerator;
	  };

export function withAutomatic(declaration: LooseQuery | LooseCommand): Loose {
	const { payload, run } = declaration;
	return run === undefined ? declaration : { ...(payload === undefined ? {} : { payload }), rejections: { InternalServerError, ServiceUnavailable } };
}

export function invalidatesOf(declaration: LooseCommand): Invalidates {
	if (declaration.run === undefined) {
		return declaration.invalidates ?? (() => []);
	}
	const { invalidates } = declaration;
	return invalidates === undefined ? () => [] : (payload, _result, viewer) => invalidates(payload, viewer);
}

export function runOf({ run }: { readonly run?: RunGenerator | undefined }) {
	return run === undefined ? {} : { run: Effect.fnUntraced(run) };
}
