import { Predicate } from "effect";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { isRequestRejection, isServerFailure, type RequestRejection, type ServerFailure } from "@shivaedev/errors/taxonomy.ts";
import { MissingReadPolicies, MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { WebSocketRequired } from "#WebSocketRequired.ts";

// The transport, the server's own failures and the contract's middleware fail every operation alike; no screen chose them.
export type FrameworkFailure = ServerFailure | RpcClientError | MissingReadPolicy | MissingReadPolicies | QueryReadDenied | WebSocketRequired;

// What remains of an operation's failure once the shared request rejections and the framework's failures are taken out: the rejections its
// feature declared for itself.
export type AppRejection<E> = Exclude<E, RequestRejection | FrameworkFailure>;

export type FailureKind = "app" | "framework" | "request";

export function isFrameworkFailure(value: unknown): value is FrameworkFailure {
	return (
		isServerFailure(value)
		|| Predicate.isTagged(value, "RpcClientError")
		|| value instanceof MissingReadPolicy
		|| value instanceof MissingReadPolicies
		|| value instanceof QueryReadDenied
		|| value instanceof WebSocketRequired
	);
}

export function failureKind(error: unknown): FailureKind {
	if (isRequestRejection(error)) {
		return "request";
	}
	const tagged = Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag);
	return tagged && !isFrameworkFailure(error) ? "app" : "framework";
}
