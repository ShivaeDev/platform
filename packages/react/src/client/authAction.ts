import { Effect, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import * as Atom from "effect/reactivity/Atom";

export interface AuthActionResult<A, E> {
	readonly data: A;
	readonly error: E | null;
}

export const AuthFailureCode = Schema.Literals([
	"USER_NOT_FOUND",
	"FAILED_TO_CREATE_USER",
	"FAILED_TO_CREATE_SESSION",
	"FAILED_TO_UPDATE_USER",
	"FAILED_TO_GET_SESSION",
	"INVALID_PASSWORD",
	"INVALID_EMAIL",
	"INVALID_EMAIL_OR_PASSWORD",
	"INVALID_USER",
	"SOCIAL_ACCOUNT_ALREADY_LINKED",
	"PROVIDER_NOT_FOUND",
	"INVALID_TOKEN",
	"TOKEN_EXPIRED",
	"ID_TOKEN_NOT_SUPPORTED",
	"FAILED_TO_GET_USER_INFO",
	"USER_EMAIL_NOT_FOUND",
	"EMAIL_NOT_VERIFIED",
	"PASSWORD_TOO_SHORT",
	"PASSWORD_TOO_LONG",
	"USER_ALREADY_EXISTS",
	"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
	"EMAIL_CAN_NOT_BE_UPDATED",
	"CHANGE_EMAIL_DISABLED",
	"CREDENTIAL_ACCOUNT_NOT_FOUND",
	"SESSION_EXPIRED",
	"FAILED_TO_UNLINK_LAST_ACCOUNT",
	"ACCOUNT_NOT_FOUND",
	"USER_ALREADY_HAS_PASSWORD",
	"CROSS_SITE_NAVIGATION_LOGIN_BLOCKED",
	"VERIFICATION_EMAIL_NOT_ENABLED",
	"EMAIL_ALREADY_VERIFIED",
	"EMAIL_MISMATCH",
	"SESSION_NOT_FRESH",
	"LINKED_ACCOUNT_ALREADY_EXISTS",
	"INVALID_ORIGIN",
	"INVALID_CALLBACK_URL",
	"INVALID_REDIRECT_URL",
	"INVALID_ERROR_CALLBACK_URL",
	"INVALID_NEW_USER_CALLBACK_URL",
	"MISSING_OR_NULL_ORIGIN",
	"CALLBACK_URL_REQUIRED",
	"FAILED_TO_CREATE_VERIFICATION",
	"FIELD_NOT_ALLOWED",
	"ASYNC_VALIDATION_NOT_SUPPORTED",
	"VALIDATION_ERROR",
	"MISSING_FIELD",
	"METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED",
	"BODY_MUST_BE_AN_OBJECT",
	"PASSWORD_ALREADY_SET",
	"RATE_LIMITED",
	"UNKNOWN",
]);
export type AuthFailureCode = typeof AuthFailureCode.Type;

export class AuthFailure extends Schema.TaggedError<AuthFailure>()("AuthFailure", {
	cause: Schema.Unknown,
	code: AuthFailureCode,
}) {}

const supportedCode = Schema.is(AuthFailureCode);

export function authCall<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): (input: TInput) => Effect.Effect<A, AuthFailure> {
	return (input) =>
		Effect.tryPromise({
			catch: (cause) => new AuthFailure({ cause, code: "UNKNOWN" }),
			try: (signal) => run(input, signal),
		}).pipe(
			Effect.flatMap(({ data, error }) => {
				if (error === null) {
					return Effect.succeed(data);
				}
				if ("code" in error && supportedCode(error.code)) {
					return Effect.fail(new AuthFailure({ cause: error, code: error.code }));
				}
				const code = "status" in error && error.status === HttpStatus.fromLiteral("TooManyRequests") ? "RATE_LIMITED" : "UNKNOWN";
				return Effect.fail(new AuthFailure({ cause: error, code }));
			}),
		);
}

export function authAction<TInput, A, E extends object = never>(
	run: (input: TInput, signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): Atom.AtomResultFn<TInput, A, AuthFailure> {
	return Atom.fn<TInput>()(authCall(run));
}
