import { type Cause, Schema } from "effect";
import { AuthFailureCode } from "./AuthFailureCode.ts";

export type AuthFailureWithCodes<TCode extends string> = Pick<AuthFailure, "_tag" | "cause"> &
	Cause.YieldableError & { readonly code: AuthFailureCode | TCode };

function withCodes<TCode extends string>(codes: readonly TCode[]) {
	return Schema.TaggedError<AuthFailureWithCodes<TCode>>()("AuthFailure", {
		cause: AuthFailure.fields.cause,
		code: Schema.Union([AuthFailureCode, Schema.Literals(codes)]),
	});
}

export class AuthFailure extends Schema.TaggedError<AuthFailure>()("AuthFailure", {
	cause: Schema.Unknown,
	code: AuthFailureCode,
}) {
	static readonly withCodes = withCodes;
}
