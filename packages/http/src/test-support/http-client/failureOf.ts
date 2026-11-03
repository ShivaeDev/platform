import { DateTime, Schema } from "effect";
import {
	InvalidBodyLimit,
	PaginationLinkError,
	RemoteGone,
	RemoteHttpError,
	RemoteNotFound,
	RemoteRateLimited,
	RemoteUnauthorized,
	ResponseBodyTooLarge,
} from "#errors.ts";

function instant(at: DateTime.Utc) {
	return DateTime.formatIso(at)
		.replace("T", " ")
		.replace(/\.\d+Z$/u, " UTC");
}

function on<T>(type: abstract new (...args: never[]) => T, phrase: (error: T) => string) {
	return (error: unknown) => (error instanceof type ? phrase(error) : undefined);
}

export function failureOf(error: unknown, pathOf: (url: string) => string) {
	const phrases = [
		on(RemoteUnauthorized, () => "unauthorized"),
		on(RemoteNotFound, () => "not found"),
		on(RemoteGone, () => "gone"),
		on(RemoteRateLimited, ({ retryAfter }) => (retryAfter === undefined ? "rate limited" : `rate limited until ${instant(retryAfter)}`)),
		on(RemoteHttpError, ({ status }) => `HTTP ${status}`),
		on(ResponseBodyTooLarge, ({ limit }) => `body over ${limit} bytes`),
		on(PaginationLinkError, ({ reason, url }) => `${reason} next link on ${pathOf(url)}`),
		on(InvalidBodyLimit, () => "invalid limit"),
		on(Schema.SchemaError, () => "Schema mismatch"),
	];
	for (const phrase of phrases) {
		const described = phrase(error);
		if (described !== undefined) {
			return described;
		}
	}
	return undefined;
}
