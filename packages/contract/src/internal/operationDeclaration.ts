import { type Option, Schema } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { OperationShape, PayloadSchema } from "#operation.ts";
import type { CollectionReads } from "#permissionReadPolicy.ts";
import type { QueryServerReads } from "#QueryServerReads.ts";
import type { Viewer } from "#readPolicy.ts";
import { type MatchingTags, type RejectedBy, type RejectionSpecs, rejectionSet } from "#rejection.ts";

export interface Declaration<TPayload extends Schema.Top | Schema.Struct.Fields, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs> {
	readonly payload?: TPayload;
	readonly rejections?: TSpecs & MatchingTags<TSpecs>;
	readonly success?: TSuccess;
}

export type QueryDeclaration<
	TPayload extends Schema.Top | Schema.Struct.Fields,
	TSuccess extends Schema.Top,
	TSpecs extends RejectionSpecs,
	R,
	TLive extends "rerun-and-compare" | undefined,
> = Declaration<TPayload, TSuccess, TSpecs> &
	CollectionReads<PayloadSchema<TPayload>["Type"], NoInfer<RejectedBy<TSpecs>>, R> & {
		readonly live?: TLive;
		readonly reads: (payload: PayloadSchema<TPayload>["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
		readonly serverReads?: QueryServerReads<PayloadSchema<TPayload>["Type"], NoInfer<RejectedBy<TSpecs>>, R>;
	};

export interface Loose {
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

export function operation<TKind extends OperationShape["kind"]>(kind: TKind, name: string, declaration: Loose) {
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
