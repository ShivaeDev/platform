import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
export function fail(code: TRPCError["code"], message: string, cause?: unknown): Effect.Effect<never, TRPCError> {
	return Effect.fail(new TRPCError({ cause, code, message }));
}
export function badRequest(message: string, cause?: unknown) {
	return fail("BAD_REQUEST", message, cause);
}
export function unauthorized(message: string, cause?: unknown) {
	return fail("UNAUTHORIZED", message, cause);
}
export function forbidden(message: string, cause?: unknown) {
	return fail("FORBIDDEN", message, cause);
}
export function notFound(message: string, cause?: unknown) {
	return fail("NOT_FOUND", message, cause);
}
export function conflict(message: string, cause?: unknown) {
	return fail("CONFLICT", message, cause);
}
export function preconditionFailed(message: string, cause?: unknown) {
	return fail("PRECONDITION_FAILED", message, cause);
}
export function internalServerError(message: string, cause?: unknown) {
	return fail("INTERNAL_SERVER_ERROR", message, cause);
}
