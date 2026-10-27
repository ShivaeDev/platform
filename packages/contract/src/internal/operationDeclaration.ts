import { Schema } from "effect";
import type { OperationShape } from "#operation.ts";
import { type RejectionSpecs, rejectionSet } from "#rejection.ts";

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
