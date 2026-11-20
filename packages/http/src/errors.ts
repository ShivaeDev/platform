import { Schema } from "effect";

const answer = { bodyExcerpt: Schema.optionalKey(Schema.String), method: Schema.String, status: Schema.Number, url: Schema.String };

function describe(answered: { readonly bodyExcerpt?: string; readonly method: string; readonly status: number; readonly url: string }): string {
	const url = new URL(answered.url);
	const call = `HTTP ${answered.status}: ${answered.method} ${url.host}${url.pathname}`;
	return answered.bodyExcerpt === undefined ? call : `${call}: ${answered.bodyExcerpt}`;
}

export class RemoteUnauthorized extends Schema.TaggedError<RemoteUnauthorized>()("RemoteUnauthorized", answer) {
	override get message(): string {
		return describe(this);
	}
}
export class RemoteNotFound extends Schema.TaggedError<RemoteNotFound>()("RemoteNotFound", answer) {
	override get message(): string {
		return describe(this);
	}
}
export class RemoteGone extends Schema.TaggedError<RemoteGone>()("RemoteGone", answer) {
	override get message(): string {
		return describe(this);
	}
}
export class RemoteRateLimited extends Schema.TaggedError<RemoteRateLimited>()("RemoteRateLimited", {
	...answer,
	retryAfter: Schema.optionalKey(Schema.DateTimeUtc),
}) {
	override get message(): string {
		return describe(this);
	}
}
export class RemoteHttpError extends Schema.TaggedError<RemoteHttpError>()("RemoteHttpError", answer) {
	override get message(): string {
		return describe(this);
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
