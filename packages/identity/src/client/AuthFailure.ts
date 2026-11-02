import { Schema } from "effect";
import { AuthFailureCode } from "./AuthFailureCode.ts";

export class AuthFailure extends Schema.TaggedError<AuthFailure>()("AuthFailure", {
	cause: Schema.Unknown,
	code: AuthFailureCode,
}) {}
