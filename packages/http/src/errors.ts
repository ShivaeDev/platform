import { Schema } from "effect";

const answer = { method: Schema.String, status: Schema.Number, url: Schema.String };

export class RemoteUnauthorized extends Schema.TaggedError<RemoteUnauthorized>()("RemoteUnauthorized", answer) {}
export class RemoteNotFound extends Schema.TaggedError<RemoteNotFound>()("RemoteNotFound", answer) {}
export class RemoteGone extends Schema.TaggedError<RemoteGone>()("RemoteGone", answer) {}
export class RemoteRateLimited extends Schema.TaggedError<RemoteRateLimited>()("RemoteRateLimited", {
	...answer,
	retryAfter: Schema.optionalKey(Schema.DateTimeUtc),
}) {}
export class RemoteHttpError extends Schema.TaggedError<RemoteHttpError>()("RemoteHttpError", answer) {
	override get message(): string {
		const url = new URL(this.url);
		return `HTTP ${this.status}: ${this.method} ${url.host}${url.pathname}`;
	}
}

const RemoteStatusError = Schema.Union([RemoteUnauthorized, RemoteNotFound, RemoteGone, RemoteRateLimited, RemoteHttpError]);
export type RemoteStatusError = typeof RemoteStatusError.Type;
export const isRemoteStatusError = Schema.is(RemoteStatusError);

export class PaginationLinkError extends Schema.TaggedError<PaginationLinkError>()("PaginationLinkError", {
	reason: Schema.Literals(["cross-origin", "invalid"]),
	url: Schema.String,
}) {}

export class ResponseBodyTooLarge extends Schema.TaggedError<ResponseBodyTooLarge>()("ResponseBodyTooLarge", {
	limit: Schema.Number,
}) {}

export class InvalidBodyLimit extends Schema.TaggedError<InvalidBodyLimit>()("InvalidBodyLimit", {
	limit: Schema.Number,
}) {}
