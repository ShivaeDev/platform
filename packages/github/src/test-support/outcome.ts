import { DateTime, Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { RemoteGone, RemoteHttpError, RemoteNotFound, RemoteRateLimited, RemoteUnauthorized, ResponseBodyTooLarge } from "@shivaedev/http/errors.ts";
import {
	GitHubAppError,
	GitHubArtifactError,
	GitHubArtifactTooLarge,
	GitHubConversationLocked,
	GitHubPermissionDenied,
	GitHubRateLimited,
	GitHubTransportError,
	GitHubWebhookSignatureError,
} from "#errors.ts";

const MEBIBYTE = 1024 * 1024;

function size(bytes: number) {
	return bytes >= MEBIBYTE && bytes % MEBIBYTE === 0 ? `${bytes / MEBIBYTE} MiB` : `${bytes} bytes`;
}

export function clockTime(instant: DateTime.DateTime) {
	return DateTime.formatIso(instant).slice(11, 19);
}

function on<T>(type: abstract new (...args: never[]) => T, phrase: (error: T) => string) {
	return (error: unknown) => (error instanceof type ? phrase(error) : undefined);
}

const phrases = [
	on(GitHubRateLimited, ({ resource, retryAt }) => `rate limited on ${resource} until ${clockTime(retryAt)}`),
	on(GitHubPermissionDenied, ({ path }) => `permission denied at ${path}`),
	on(GitHubConversationLocked, ({ path }) => `conversation locked at ${path}`),
	on(GitHubTransportError, ({ path }) => `transport failure at ${path}`),
	on(GitHubAppError, ({ reason, status }) => {
		if (reason === "sign") {
			return "App JWT signing failed";
		}
		return reason === "status" ? `token exchange refused with HTTP ${status}` : `token exchange ${reason} failed`;
	}),
	on(GitHubArtifactError, ({ stage, status }) => `artifact ${stage} answered HTTP ${status}`),
	on(GitHubArtifactTooLarge, ({ limit }) => `archive over ${size(limit)}`),
	on(GitHubWebhookSignatureError, () => "signature rejected"),
	on(ResponseBodyTooLarge, ({ limit }) => `body over ${size(limit)}`),
	on(RemoteUnauthorized, () => "unauthorized"),
	on(RemoteNotFound, () => "not found"),
	on(RemoteGone, () => "gone"),
	on(RemoteRateLimited, ({ status }) => `HTTP ${status}`),
	on(RemoteHttpError, ({ status }) => `HTTP ${status}`),
	on(Schema.SchemaError, () => "Schema mismatch"),
	on(ServiceUnavailable, ({ message }) => `unavailable: ${message}`),
];

function failureOf(error: unknown) {
	for (const phrase of phrases) {
		const described = phrase(error);
		if (described !== undefined) {
			return described;
		}
	}
	return `unexpected failure: ${String(error)}`;
}

export function answered<A, E, R>(effect: Effect.Effect<A, E, R>, failures?: unknown[]): Effect.Effect<A | string, never, R> {
	return Effect.catch(effect, (error) =>
		Effect.sync(() => {
			failures?.push(error);
			return failureOf(error);
		}),
	);
}
