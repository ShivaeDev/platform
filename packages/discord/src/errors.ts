import { Schema } from "effect";

export class DiscordTransportError extends Schema.TaggedError<DiscordTransportError>()("DiscordTransportError", {}) {}

export class DiscordRateLimited extends Schema.TaggedError<DiscordRateLimited>()("DiscordRateLimited", {
	retryAfter: Schema.Number,
}) {}

export class DiscordGatewayClosed extends Schema.TaggedError<DiscordGatewayClosed>()("DiscordGatewayClosed", {
	code: Schema.Number,
}) {}

export class DiscordGatewayProtocolError extends Schema.TaggedError<DiscordGatewayProtocolError>()("DiscordGatewayProtocolError", {}) {}
