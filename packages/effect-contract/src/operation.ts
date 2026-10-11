import { Schema } from "effect";
import type { Bivariant } from "@shivaedev/types/bivariant.ts";
import type { Key } from "./keys.ts";
import { type MatchingTags, type Reject, type RejectionSpecs, type Rejections, type RejectionUnion, rejectionSet } from "./rejection.ts";

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

export interface QueryShape extends OperationShape {
	readonly kind: "query";
	reads: Bivariant<(payload: unknown) => readonly Key[]>;
}

export interface StreamShape extends OperationShape {
	readonly kind: "stream";
	reads: Bivariant<(payload: unknown) => readonly Key[]>;
}

export interface CommandShape extends OperationShape {
	invalidates: Bivariant<(payload: unknown, result: unknown) => readonly Key[]>;
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

export interface Query<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "query";
	reads: (payload: TPayload["Type"]) => readonly Key[];
}

export interface Streaming<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "stream";
	reads: (payload: TPayload["Type"]) => readonly Key[];
}

export interface Command<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	invalidates: (payload: TPayload["Type"], result: TSuccess["Type"]) => readonly Key[];
	readonly kind: "command";
}

interface Declaration<TPayload extends Schema.Top | Schema.Struct.Fields, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs> {
	readonly payload?: TPayload;
	readonly rejections?: TSpecs & MatchingTags<TSpecs>;
	readonly success?: TSuccess;
}

interface Loose {
	readonly payload?: Schema.Top | Schema.Struct.Fields;
	readonly rejections?: RejectionSpecs;
	readonly success?: Schema.Top;
}

function payloadSchema(payload: Loose["payload"]): Schema.Top {
	if (payload === undefined) {
		return Schema.Void;
	}
	return Schema.isSchema(payload) ? payload : Schema.Struct(payload);
}

function operation<TKind extends OperationShape["kind"]>(kind: TKind, name: string, declaration: Loose) {
	const { payload, success, rejections = {} } = declaration;
	return {
		kind,
		name,
		payload: payloadSchema(payload),
		rejections,
		success: success ?? Schema.Void,
		...rejectionSet(rejections),
	};
}

export function query<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
>(
	name: TName,
	declaration: Declaration<TPayload, TSuccess, TSpecs> & {
		readonly reads: (payload: PayloadSchema<TPayload>["Type"]) => readonly Key[];
	},
): NoInfer<Query<TName, PayloadSchema<TPayload>, TSuccess, TSpecs>>;
export function query(name: string, declaration: Loose & { readonly reads: (payload: unknown) => readonly Key[] }): QueryShape {
	return { ...operation("query", name, declaration), reads: declaration.reads };
}

export function command<
	const TName extends string,
	TPayload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	TSuccess extends Schema.Top = Schema.Void,
	const TSpecs extends RejectionSpecs = NoRejections,
>(
	name: TName,
	declaration: Declaration<TPayload, TSuccess, TSpecs> & {
		readonly invalidates: (payload: PayloadSchema<TPayload>["Type"], result: TSuccess["Type"]) => readonly Key[];
	},
): NoInfer<Command<TName, PayloadSchema<TPayload>, TSuccess, TSpecs>>;
export function command(
	name: string,
	declaration: Loose & { readonly invalidates: (payload: unknown, result: unknown) => readonly Key[] },
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
