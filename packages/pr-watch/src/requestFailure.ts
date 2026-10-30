import { Cause, DateTime } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { GitHubConversationLocked, GitHubPermissionDenied, GitHubRateLimited, GitHubTransportError } from "@shivaedev/github/errors.ts";
import {
	RemoteGone,
	RemoteHttpError,
	RemoteNotFound,
	RemoteRateLimited,
	type RemoteStatusError,
	RemoteUnauthorized,
} from "@shivaedev/http/errors.ts";
import { WatchError } from "#model.ts";

export function requestFailure(error: unknown): { readonly message: string; readonly retryable: boolean; readonly retryAt?: number } {
	if (error instanceof WatchError) {
		return { message: error.message, retryable: error.reason === "cooldown", ...(error.retryAt === undefined ? {} : { retryAt: error.retryAt }) };
	}
	if (error instanceof GitHubRateLimited) {
		return { message: `GitHub rate limit (${error.resource})`, retryAt: DateTime.toEpochMillis(error.retryAt), retryable: true };
	}
	if (error instanceof GitHubTransportError) {
		return { message: `GitHub network error at ${error.path}`, retryable: true };
	}
	if (Cause.isTimeoutError(error)) {
		return { message: "GitHub request timed out after 30 seconds", retryable: true };
	}
	if (error instanceof GitHubPermissionDenied || error instanceof GitHubConversationLocked) {
		return { message: `${error._tag} at ${error.path}`, retryable: false };
	}
	if (isHttpFailure(error)) {
		return {
			message: `GitHub HTTP ${error.status} (${error.method} ${new URL(error.url).pathname})`,
			retryable: error.status >= HttpStatus.fromLiteral("InternalServerError") && error.status < 600,
			...(error instanceof RemoteRateLimited && error.retryAfter !== undefined ? { retryAt: DateTime.toEpochMillis(error.retryAfter) } : {}),
		};
	}
	return { message: `GitHub request failed: ${error instanceof Error ? error.message || error.name : String(error)}`, retryable: false };
}

function isHttpFailure(error: unknown): error is RemoteStatusError {
	return (
		error instanceof RemoteHttpError
		|| error instanceof RemoteUnauthorized
		|| error instanceof RemoteNotFound
		|| error instanceof RemoteGone
		|| error instanceof RemoteRateLimited
	);
}
