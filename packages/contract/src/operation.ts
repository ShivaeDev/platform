import type { Effect, Option, Schema } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { Bivariant } from "@shivaedev/types/Bivariant.ts";
import { type CommandDeclaration, type Loose, operation, type QueryDeclaration, type StreamDeclaration } from "#operationDeclaration.ts";
import type { QueryServerReads } from "#QueryServerReads.ts";
import { type QueryReadPolicy, signedIn, type Viewer } from "#readPolicy.ts";
import type { Reject, RejectedBy, RejectionSpecs, Rejections, RejectionUnion } from "#rejection.ts";
import type { ClassRejections, Pending, RunEffect, SpecsOf, SuccessSchema } from "#runProof.ts";
import type { LooseCommand, LooseQuery, RunCommandDeclaration, RunQueryDeclaration, ServedCommand, ServedQueryOf } from "#servedOperation.ts";
import { runOf, withAutomatic } from "#servedOperation.ts";

export type PayloadSchema<TPayload extends Schema.Top | Schema.Struct.Fields> = TPayload extends Schema.Struct.Fields
	? Schema.Struct<TPayload>
	: TPayload;

type NoRejections = Record<never, never>;

export interface OperationShape {
	readonly error: Schema.Top;
	readonly kind: "query" | "command" | "stream";
	readonly name: string;
	readonly payload: Schema.Top;
	readonly Rejection: object;
	readonly reject: object;
	readonly rejections: RejectionSpecs;
	readonly success: Schema.Top;
}

export interface QueryShape<E = unknown, R = unknown> extends OperationShape {
	readonly kind: "query";
	readonly readPolicy: Bivariant<QueryReadPolicy<unknown, E, R>>;
	reads: Bivariant<(payload: unknown, viewer: Option.Option<Viewer>) => readonly Key[]>;
	readonly readsCollections?: readonly { readonly name: string }[] | undefined;
	readonly serverReads?: Bivariant<QueryServerReads<unknown, E, R>>;
}

export interface StreamShape extends OperationShape {
	readonly kind: "stream";
	reads: Bivariant<(payload: unknown) => readonly Key[]>;
}

export interface CommandShape extends OperationShape {
	invalidates: Bivariant<(payload: unknown, result: unknown, viewer?: Option.Option<Viewer>) => readonly Key[]>;
	readonly kind: "command";
}

export interface Operation<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends OperationShape {
	readonly error: RejectionUnion<TSpecs>;
	readonly name: TName;
	readonly payload: TPayload;
	readonly Rejection: Rejections<TSpecs>;
	readonly reject: Reject<TSpecs>;
	readonly rejections: TSpecs;
	readonly success: TSuccess;
}

export interface Query<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs, R = never>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "query";
	readonly readPolicy: QueryReadPolicy<TPayload["Type"], RejectedBy<TSpecs>, R>;
	reads: (payload: TPayload["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
	readonly readsCollections?: readonly { readonly name: string }[] | undefined;
	readonly serverReads?: QueryServerReads<TPayload["Type"], RejectedBy<TSpecs>, R>;
}

export interface Streaming<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "stream";
	reads: (payload: TPayload["Type"]) => readonly Key[];
}

export interface Command<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	invalidates: (payload: TPayload["Type"], result: TSuccess["Type"], viewer?: Option.Option<Viewer>) => readonly Key[];
	readonly kind: "command";
}

export function query<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
	R = never,
>(name: TName, declaration: QueryDeclaration<TPayload, TSuccess, TSpecs, R>): NoInfer<Query<TName, PayloadSchema<TPayload>, TSuccess, TSpecs, R>>;
export function query<
	const TName extends string,
	TYielded extends Effect.Effect<unknown, unknown, unknown> = never,
	TReturn = Pending,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top | undefined = undefined,
	const TSpecs extends ClassRejections | undefined = undefined,
	TPolicyError = never,
	TPolicyServices = never,
	TReads extends Effect.Effect<readonly Key[], unknown, unknown> = never,
	const TCollections extends readonly { readonly name: string }[] | undefined = undefined,
>(
	name: TName,
	declaration: RunQueryDeclaration<TName, TPayload, TYielded, TReturn, TSuccess, TSpecs, TPolicyError, TPolicyServices, TReads, TCollections>,
): NoInfer<ServedQueryOf<TName, TPayload, TYielded, TReturn, TSuccess, TSpecs, TPolicyError, TPolicyServices, TReads>>;
export function query(name: string, declaration: LooseQuery): QueryShape {
	const collections: readonly Key[] = declaration.readsCollections?.map((collection) => ({ _tag: "List", collection: collection.name })) ?? [];
	return {
		...operation("query", name, withAutomatic(declaration)),
		readPolicy: declaration.readPolicy ?? signedIn,
		reads: (payload, viewer) => [...declaration.reads(payload, viewer), ...collections],
		readsCollections: declaration.readsCollections,
		...(declaration.serverReads === undefined ? {} : { serverReads: declaration.serverReads }),
		...runOf(declaration),
	};
}

export function command<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
>(name: TName, declaration: CommandDeclaration<TPayload, TSuccess, TSpecs>): NoInfer<Command<TName, PayloadSchema<TPayload>, TSuccess, TSpecs>>;
export function command<
	const TName extends string,
	TYielded extends Effect.Effect<unknown, unknown, unknown> = never,
	TReturn = Pending,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top | undefined = undefined,
	const TSpecs extends ClassRejections | undefined = undefined,
>(
	name: TName,
	declaration: RunCommandDeclaration<TName, TPayload, TYielded, TReturn, TSuccess, TSpecs>,
): NoInfer<ServedCommand<TName, PayloadSchema<TPayload>, SuccessSchema<TSuccess>, SpecsOf<TSpecs>, RunEffect<TYielded, TReturn>>>;
export function command(name: string, declaration: LooseCommand): CommandShape {
	return { ...operation("command", name, withAutomatic(declaration)), invalidates: declaration.invalidates ?? (() => []), ...runOf(declaration) };
}

export function stream<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
>(name: TName, declaration: StreamDeclaration<TPayload, TSuccess, TSpecs>): NoInfer<Streaming<TName, PayloadSchema<TPayload>, TSuccess, TSpecs>>;
export function stream(name: string, declaration: Loose & { readonly reads: (payload: unknown) => readonly Key[] }): StreamShape {
	return { ...operation("stream", name, declaration), reads: declaration.reads };
}
