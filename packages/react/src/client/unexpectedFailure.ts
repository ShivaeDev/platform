import { Cause, Option, Predicate } from "effect";
import { isAuthUnavailable, isInternalServerError, isServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

// `cause` is for the application's diagnostics; only `message` is meant for the person.
export interface UnexpectedFailure {
	readonly cause: Cause.Cause<unknown>;
	readonly kind: "connection" | "unavailable" | "unexpected";
	readonly message: string;
}

export function unexpectedFailure(cause: Cause.Cause<unknown>): UnexpectedFailure {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	if (Predicate.isTagged(error, "RpcClientError") || Predicate.isTagged(error, "WebSocketRequired")) {
		return { cause, kind: "connection", message: "Could not reach the server. Check your connection and try again." };
	}
	// These messages come from the server's handler edge, which has already redacted them.
	if (isServiceUnavailable(error) || isAuthUnavailable(error)) {
		return { cause, kind: "unavailable", message: error.message };
	}
	if (isInternalServerError(error)) {
		return { cause, kind: "unexpected", message: error.message };
	}
	return { cause, kind: "unexpected", message: "Something went wrong. Try again." };
}
