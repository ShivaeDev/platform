import { Schema } from "effect";
import type { Key } from "./keys.ts";
import { type MatchingTags, type Reject, type RejectionSpecs, type Rejections, type RejectionUnion, rejectionSet } from "./rejection.ts";

export type PayloadSchema<Payload extends Schema.Top | Schema.Struct.Fields> = Payload extends Schema.Struct.Fields
	? Schema.Struct<Payload>
	: Payload;

type NoRejections = Record<never, never>;

export interface OperationShape {
	readonly error: Schema.Top;
	readonly kind: "query" | "command";
	readonly name: string;
	readonly payload: Schema.Top;
	readonly Rejection: object;
	readonly reject: object;
	readonly rejections: RejectionSpecs;
	readonly success: Schema.Top;
}

export interface QueryShape extends OperationShape {
	readonly kind: "query";
	reads(payload: unknown): ReadonlyArray<Key>;
}

export interface CommandShape extends OperationShape {
	invalidates(payload: unknown, result: unknown): ReadonlyArray<Key>;
	readonly kind: "command";
}

interface Operation<Name extends string, Payload extends Schema.Top, Success extends Schema.Top, Specs extends RejectionSpecs>
	extends OperationShape {
	readonly error: RejectionUnion<Specs>;
	readonly name: Name;
	readonly payload: Payload;
	readonly Rejection: Rejections<Specs>;
	readonly reject: Reject<Specs>;
	readonly rejections: Specs;
	readonly success: Success;
}

export interface Query<Name extends string, Payload extends Schema.Top, Success extends Schema.Top, Specs extends RejectionSpecs>
	extends Operation<Name, Payload, Success, Specs> {
	readonly kind: "query";
	reads(payload: Payload["Type"]): ReadonlyArray<Key>;
}

export interface Command<Name extends string, Payload extends Schema.Top, Success extends Schema.Top, Specs extends RejectionSpecs>
	extends Operation<Name, Payload, Success, Specs> {
	invalidates(payload: Payload["Type"], result: Success["Type"]): ReadonlyArray<Key>;
	readonly kind: "command";
}

interface Declaration<Payload extends Schema.Top | Schema.Struct.Fields, Success extends Schema.Top, Specs extends RejectionSpecs> {
	readonly payload?: Payload;
	readonly rejections?: Specs & MatchingTags<Specs>;
	readonly success?: Success;
}

interface Loose {
	readonly payload?: Schema.Top | Schema.Struct.Fields;
	readonly rejections?: RejectionSpecs;
	readonly success?: Schema.Top;
}

const payloadSchema = (payload: Loose["payload"]): Schema.Top => {
	if (payload === undefined) return Schema.Void;
	return Schema.isSchema(payload) ? payload : Schema.Struct(payload);
};

const operation = <Kind extends OperationShape["kind"]>(kind: Kind, name: string, declaration: Loose) => {
	const { payload, success, rejections = {} } = declaration;
	return {
		kind,
		name,
		payload: payloadSchema(payload),
		rejections,
		success: success ?? Schema.Void,
		...rejectionSet(rejections),
	};
};

export function query<
	const Name extends string,
	Payload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	Success extends Schema.Top = Schema.Void,
	const Specs extends RejectionSpecs = NoRejections,
>(
	name: Name,
	declaration: Declaration<Payload, Success, Specs> & {
		readonly reads: (payload: PayloadSchema<Payload>["Type"]) => ReadonlyArray<Key>;
	},
): NoInfer<Query<Name, PayloadSchema<Payload>, Success, Specs>>;
export function query(name: string, declaration: Loose & { readonly reads: (payload: unknown) => ReadonlyArray<Key> }): QueryShape {
	return { ...operation("query", name, declaration), reads: declaration.reads };
}

export function command<
	const Name extends string,
	Payload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
	Success extends Schema.Top = Schema.Void,
	const Specs extends RejectionSpecs = NoRejections,
>(
	name: Name,
	declaration: Declaration<Payload, Success, Specs> & {
		readonly invalidates: (payload: PayloadSchema<Payload>["Type"], result: Success["Type"]) => ReadonlyArray<Key>;
	},
): NoInfer<Command<Name, PayloadSchema<Payload>, Success, Specs>>;
export function command(
	name: string,
	declaration: Loose & { readonly invalidates: (payload: unknown, result: unknown) => ReadonlyArray<Key> },
): CommandShape {
	return { ...operation("command", name, declaration), invalidates: declaration.invalidates };
}
