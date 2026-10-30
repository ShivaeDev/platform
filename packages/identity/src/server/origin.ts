import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/http";
import { localTransport } from "#server/local.ts";
import { transportHeaders } from "#server/transportHeaders.ts";
export interface OriginRequest {
	readonly headers: Headers.Headers;
	readonly origin: Option.Option<string>;
	readonly remoteAddress?: Option.Option<string>;
	readonly rpc: string;
}
export type OriginPolicy = (request: OriginRequest) => boolean;
export interface TrustedOriginsOptions {
	readonly allow: readonly string[];
	readonly missing: "allow" | "reject";
	readonly sameOrigin?: { readonly trustedProxy?: string | undefined };
}
export function trustedOrigins(options: TrustedOriginsOptions): OriginPolicy {
	const sameOrigin = options.sameOrigin === undefined ? undefined : localTransport(options.sameOrigin.trustedProxy);
	return (request) =>
		Option.match(request.origin, {
			onNone: () => options.missing === "allow",
			onSome: (value) =>
				options.allow.includes(value) || sameOrigin?.({ headers: request.headers, remoteAddress: request.remoteAddress ?? Option.none() }) === true,
		});
}
export function originRequest(headers: Headers.Headers, rpc: string, remoteAddress: Option.Option<string> = Option.none()): OriginRequest {
	return {
		headers,
		origin: Headers.get(headers, "origin"),
		remoteAddress,
		rpc,
	};
}

export const transportOriginRequest = Effect.fn("Identity.transportOriginRequest")(function* (headers: Headers.Headers, rpc: string) {
	const transport = yield* transportHeaders(headers);
	const request = yield* Effect.serviceOption(HttpServerRequest.HttpServerRequest);
	return originRequest(
		transport,
		rpc,
		Option.flatMap(request, (value) => value.remoteAddress),
	);
});
