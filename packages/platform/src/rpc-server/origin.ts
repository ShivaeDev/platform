import { Option } from "effect";
import { Headers } from "effect/unstable/http";

export interface OriginRequest {
	readonly origin: Option.Option<string>;
	readonly rpc: string;
	readonly headers: Headers.Headers;
}

export type OriginPolicy = (request: OriginRequest) => boolean;

export interface TrustedOriginsOptions {
	readonly allow: ReadonlyArray<string>;
	readonly missing: "allow" | "reject";
}

export const trustedOrigins =
	(options: TrustedOriginsOptions): OriginPolicy =>
	({ origin }) =>
		Option.match(origin, {
			onNone: () => options.missing === "allow",
			onSome: (value) => options.allow.includes(value),
		});

export const originRequest = (headers: Headers.Headers, rpc: string): OriginRequest => ({
	origin: Headers.get(headers, "origin"),
	rpc,
	headers,
});
