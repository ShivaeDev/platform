import { Option } from "effect";
import type { OriginPolicy, TrustedOriginsOptions } from "#server/origin.ts";
import { localTransport } from "./local.ts";

export function trustedOrigins(options: TrustedOriginsOptions): OriginPolicy {
	const sameOrigin = options.sameOrigin === undefined ? undefined : localTransport(options.sameOrigin.trustedProxy);
	return (request) =>
		Option.match(request.origin, {
			onNone: () => options.missing === "allow",
			onSome: (value) =>
				options.allow.includes(value) || sameOrigin?.({ headers: request.headers, remoteAddress: request.remoteAddress ?? Option.none() }) === true,
		});
}
