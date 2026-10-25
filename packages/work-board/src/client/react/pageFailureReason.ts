import { Predicate, Schema } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";

export function pageFailureReason(failure: unknown): string {
	if (
		Schema.isSchemaError(failure)
		|| (failure instanceof RpcClientError && failure.reason._tag === "RpcClientDefect" && failure.reason.message === "Error decoding HTTP response")
		|| (typeof failure === "string" && failure.startsWith("Unknown request tag:"))
	) {
		return "The browser app is out of date with the server; reload.";
	}
	if (Predicate.hasProperty(failure, "message") && typeof failure.message === "string") {
		return Predicate.hasProperty(failure, "_tag") ? `${failure._tag}: ${failure.message}` : failure.message;
	}
	return String(failure ?? "The server returned no error details. Retry the page.");
}
