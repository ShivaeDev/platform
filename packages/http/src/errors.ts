import { Schema } from "effect";

const answer = { method: Schema.String, status: Schema.Number, url: Schema.String };

export class RemoteUnauthorized extends Schema.TaggedError<RemoteUnauthorized>()("RemoteUnauthorized", answer) {}
export class RemoteNotFound extends Schema.TaggedError<RemoteNotFound>()("RemoteNotFound", answer) {}
export class RemoteGone extends Schema.TaggedError<RemoteGone>()("RemoteGone", answer) {}
export class RemoteRateLimited extends Schema.TaggedError<RemoteRateLimited>()("RemoteRateLimited", {
	...answer,
	retryAfter: Schema.optionalKey(Schema.DateTimeUtc),
}) {}
export class RemoteHttpError extends Schema.TaggedError<RemoteHttpError>()("RemoteHttpError", answer) {}

export type RemoteStatusError = RemoteUnauthorized | RemoteNotFound | RemoteGone | RemoteRateLimited | RemoteHttpError;

export class PaginationLinkError extends Schema.TaggedError<PaginationLinkError>()("PaginationLinkError", {
	reason: Schema.Literals(["cross-origin", "invalid"]),
	url: Schema.String,
}) {}

export class ResponseBodyTooLarge extends Schema.TaggedError<ResponseBodyTooLarge>()("ResponseBodyTooLarge", {
	limit: Schema.Number,
}) {}
