import { StandardSchemaV1Error, type TRPCDefaultErrorShape, type TRPCError } from "@trpc/server";
import type { EncodedRejection } from "#rejectionDecoding.ts";
import { type DeclaredRejection, RejectionError } from "./rejection.ts";
export interface RejectionData {
	readonly rejection?: EncodedRejection;
}
export type RejectionErrorShape = TRPCDefaultErrorShape & {
	readonly data: RejectionData;
};
function inputRejection({ issues: [issue] }: StandardSchemaV1Error): EncodedRejection | undefined {
	if (issue === undefined) {
		return undefined;
	}
	const field = (issue.path ?? []).map((segment) => String(typeof segment === "object" ? segment.key : segment)).join(".");
	return field === ""
		? { _tag: "BadRequest", invalidInput: true, message: issue.message }
		: { _tag: "BadRequest", field, invalidInput: true, message: issue.message };
}
function declared({ invalidInput: _reserved, ...rejection }: DeclaredRejection): EncodedRejection {
	return rejection;
}
function rejectionFrom(error: TRPCError): EncodedRejection | undefined {
	if (error instanceof RejectionError) {
		return declared(error.rejection);
	}
	if (error.code === "BAD_REQUEST" && error.cause instanceof StandardSchemaV1Error) {
		return inputRejection(error.cause);
	}
	return undefined;
}
export function withRejection<
	TShape extends {
		readonly data: object;
	},
>(
	shape: TShape,
	error: TRPCError,
): TShape & {
	readonly data: RejectionData;
} {
	const rejection = rejectionFrom(error);
	return rejection === undefined ? shape : { ...shape, data: { ...shape.data, rejection } };
}
export function rejectionFormatter({ shape, error }: { readonly shape: TRPCDefaultErrorShape; readonly error: TRPCError }): RejectionErrorShape {
	return withRejection(shape, error);
}
