import { Cause, Option, Predicate } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { isAuthUnavailable, isInternalServerError, isServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

// `cause` is for the application's diagnostics; only `message` is meant for the person.
export interface UnexpectedFailure {
	readonly cause: Cause.Cause<unknown>;
	readonly kind: "connection" | "tooLarge" | "unavailable" | "unexpected";
	readonly message: string;
}

const MESSAGE_TOO_BIG = 1009;

export function unexpectedFailure(cause: Cause.Cause<unknown>): UnexpectedFailure {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	if (error instanceof RpcClientError && error.reason._tag === "SocketCloseError" && error.reason.code === MESSAGE_TOO_BIG) {
		return { cause, kind: "tooLarge", message: "What you sent is too large for the server. Try again with something smaller." };
	}
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
