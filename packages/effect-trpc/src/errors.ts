import { TRPCError } from "@trpc/server";
import { Effect } from "effect";

export const fail = (
	code: TRPCError["code"],
	message: string,
	cause?: unknown,
): Effect.Effect<never, TRPCError> =>
	Effect.fail(new TRPCError({ cause, code, message }));

export const badRequest = (message: string, cause?: unknown) =>
	fail("BAD_REQUEST", message, cause);

export const unauthorized = (message: string, cause?: unknown) =>
	fail("UNAUTHORIZED", message, cause);

export const forbidden = (message: string, cause?: unknown) =>
	fail("FORBIDDEN", message, cause);

export const notFound = (message: string, cause?: unknown) =>
	fail("NOT_FOUND", message, cause);

export const conflict = (message: string, cause?: unknown) =>
	fail("CONFLICT", message, cause);

export const preconditionFailed = (message: string, cause?: unknown) =>
	fail("PRECONDITION_FAILED", message, cause);

export const internalServerError = (message: string, cause?: unknown) =>
	fail("INTERNAL_SERVER_ERROR", message, cause);
