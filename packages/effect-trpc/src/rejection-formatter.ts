import { StandardSchemaV1Error, type TRPCDefaultErrorShape, type TRPCError } from "@trpc/server";
import type { EncodedRejection } from "./client/rejection.ts";
import { type DeclaredRejection, RejectionError } from "./rejection.ts";

export interface RejectionData {
	readonly rejection?: EncodedRejection;
}

export type RejectionErrorShape = TRPCDefaultErrorShape & { readonly data: RejectionData };

const inputRejection = ({ issues: [issue] }: StandardSchemaV1Error): EncodedRejection | undefined => {
	if (issue === undefined) return undefined;
	const field = (issue.path ?? []).map((segment) => String(typeof segment === "object" ? segment.key : segment)).join(".");
	return field === ""
		? { _tag: "BadRequest", message: issue.message, invalidInput: true }
		: { _tag: "BadRequest", message: issue.message, field, invalidInput: true };
};

const declared = ({ invalidInput: _reserved, ...rejection }: DeclaredRejection): EncodedRejection => rejection;

const rejectionFrom = (error: TRPCError): EncodedRejection | undefined => {
	if (error instanceof RejectionError) return declared(error.rejection);
	if (error.code === "BAD_REQUEST" && error.cause instanceof StandardSchemaV1Error) return inputRejection(error.cause);
	return undefined;
};

export const withRejection = <Shape extends { readonly data: object }>(shape: Shape, error: TRPCError): Shape & { readonly data: RejectionData } => {
	const rejection = rejectionFrom(error);
	return rejection === undefined ? shape : { ...shape, data: { ...shape.data, rejection } };
};

export const rejectionFormatter = ({ shape, error }: { readonly shape: TRPCDefaultErrorShape; readonly error: TRPCError }): RejectionErrorShape =>
	withRejection(shape, error);
