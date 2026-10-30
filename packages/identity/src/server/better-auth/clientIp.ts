import { getIP } from "better-auth/api";
import { Option } from "effect";
import type { HttpServerRequest } from "effect/http";
import { trustedProxyPeer } from "#server/local.ts";
import { trustedProxyRanges } from "#server/trustedProxyRanges.ts";

export const PEER_IP_HEADER = "x-platform-client-ip";

export function clientIpHeaders(options: {
	readonly clientIpHeader: string;
	readonly ipv6Subnet?: number | undefined;
	readonly trustedProxy?: string | undefined;
}) {
	const trustedPeer = trustedProxyPeer(options.trustedProxy);
	const advanced = {
		ipAddress: {
			ipAddressHeaders: [options.clientIpHeader],
			...(options.ipv6Subnet === undefined ? {} : { ipv6Subnet: options.ipv6Subnet }),
			trustedProxies: trustedProxyRanges(options.trustedProxy),
		},
	};
	return (request: HttpServerRequest.HttpServerRequest, web: Request) => {
		web.headers.delete(PEER_IP_HEADER);
		const trusted = Option.exists(request.remoteAddress, trustedPeer);
		const forwardedIp = trusted ? getIP(web, { advanced }) : null;
		if (!trusted) {
			web.headers.delete("x-forwarded-for");
			web.headers.delete(options.clientIpHeader);
		}
		const address = forwardedIp ?? Option.getOrUndefined(request.remoteAddress);
		if (address !== undefined) {
			web.headers.set(PEER_IP_HEADER, address);
		}
	};
}
