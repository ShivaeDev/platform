import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/http";
import { transportHeaders } from "#server/transportHeaders.ts";
export interface OriginRequest {
	readonly headers: Headers.Headers;
	readonly origin: Option.Option<string>;
	readonly remoteAddress?: Option.Option<string>;
	readonly rpc: string;
}
export interface OriginPolicy {
	readonly trustedOrigins?: readonly string[];
	(request: OriginRequest): boolean;
}
export interface TrustedOriginsOptions {
	readonly allow: readonly string[];
	readonly missing: "allow" | "reject";
	readonly sameOrigin?: { readonly trustedProxy?: string | undefined };
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
