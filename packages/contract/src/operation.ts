import type { Option, Schema } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { Bivariant } from "@shivaedev/types/Bivariant.ts";
import { type Loose, operation } from "#internal/operationDeclaration.ts";
import type { QueryReadPolicy, Viewer } from "#readPolicy.ts";
import type { MatchingTags, Reject, RejectedBy, RejectionSpecs, Rejections, RejectionUnion } from "#rejection.ts";

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
	readonly live?: "rerun-and-compare" | undefined;
	readonly readPolicy?: Bivariant<QueryReadPolicy<unknown, E, R>>;
	reads: Bivariant<(payload: unknown, viewer: Option.Option<Viewer>) => readonly Key[]>;
}

export interface StreamShape extends OperationShape {
	readonly kind: "stream";
	reads: Bivariant<(payload: unknown) => readonly Key[]>;
}

export interface CommandShape extends OperationShape {
	invalidates: Bivariant<(payload: unknown, result: unknown, viewer?: Option.Option<Viewer>) => readonly Key[]>;
	readonly kind: "command";
}

interface Operation<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends OperationShape {
	readonly error: RejectionUnion<TSpecs>;
	readonly name: TName;
	readonly payload: TPayload;
	readonly Rejection: Rejections<TSpecs>;
	readonly reject: Reject<TSpecs>;
	readonly rejections: TSpecs;
	readonly success: TSuccess;
}

export interface Query<
	TName extends string,
	TPayload extends Schema.Top,
	TSuccess extends Schema.Top,
	TSpecs extends RejectionSpecs,
	R = never,
	TLive extends "rerun-and-compare" | undefined = undefined,
> extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "query";
	readonly live?: TLive;
	readonly readPolicy?: QueryReadPolicy<TPayload["Type"], RejectedBy<TSpecs>, R>;
	reads: (payload: TPayload["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
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

interface Declaration<TPayload extends Schema.Top | Schema.Struct.Fields, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs> {
	readonly payload?: TPayload;
	readonly rejections?: TSpecs & MatchingTags<TSpecs>;
	readonly success?: TSuccess;
}

export function query<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
	R = never,
	const TLive extends "rerun-and-compare" | undefined = undefined,
>(
	name: TName,
	declaration: Declaration<TPayload, TSuccess, TSpecs> & {
		readonly live?: TLive;
		readonly reads: (payload: PayloadSchema<TPayload>["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
		readonly readPolicy?: QueryReadPolicy<PayloadSchema<TPayload>["Type"], NoInfer<RejectedBy<TSpecs>>, R>;
	},
): NoInfer<Query<TName, PayloadSchema<TPayload>, TSuccess, TSpecs, R, TLive>>;
export function query(
	name: string,
	declaration: Loose & {
		readonly live?: "rerun-and-compare" | undefined;
		readonly reads: (payload: unknown, viewer: Option.Option<Viewer>) => readonly Key[];
		readonly readPolicy?: QueryReadPolicy<unknown, unknown, unknown>;
	},
): QueryShape {
	return {
		...operation("query", name, declaration),
		live: declaration.live,
		reads: declaration.reads,
		...(declaration.readPolicy === undefined ? {} : { readPolicy: declaration.readPolicy }),
	};
}

export function command<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
>(
	name: TName,
	declaration: Declaration<TPayload, TSuccess, TSpecs> & {
		readonly invalidates: (payload: PayloadSchema<TPayload>["Type"], result: TSuccess["Type"], viewer?: Option.Option<Viewer>) => readonly Key[];
	},
): NoInfer<Command<TName, PayloadSchema<TPayload>, TSuccess, TSpecs>>;
export function command(
	name: string,
	declaration: Loose & { readonly invalidates: (payload: unknown, result: unknown, viewer?: Option.Option<Viewer>) => readonly Key[] },
): CommandShape {
	return { ...operation("command", name, declaration), invalidates: declaration.invalidates };
}

export function stream<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
>(
	name: TName,
	declaration: Declaration<TPayload, TSuccess, TSpecs> & {
		readonly success: TSuccess;
		readonly reads: (payload: PayloadSchema<TPayload>["Type"]) => readonly Key[];
	},
): NoInfer<Streaming<TName, PayloadSchema<TPayload>, TSuccess, TSpecs>>;
export function stream(name: string, declaration: Loose & { readonly reads: (payload: unknown) => readonly Key[] }): StreamShape {
	return { ...operation("stream", name, declaration), reads: declaration.reads };
}
