import { Option } from "effect";
import { Headers } from "effect/http";
export interface OriginRequest {
	readonly headers: Headers.Headers;
	readonly origin: Option.Option<string>;
	readonly rpc: string;
}
export type OriginPolicy = (request: OriginRequest) => boolean;
export interface TrustedOriginsOptions {
	readonly allow: readonly string[];
	readonly missing: "allow" | "reject";
}
export function trustedOrigins(options: TrustedOriginsOptions): OriginPolicy {
	return ({ origin }) =>
		Option.match(origin, {
			onNone: () => options.missing === "allow",
			onSome: (value) => options.allow.includes(value),
		});
}
export function originRequest(headers: Headers.Headers, rpc: string): OriginRequest {
	return {
		headers,
		origin: Headers.get(headers, "origin"),
		rpc,
	};
}
