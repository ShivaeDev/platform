import { proxyRanges } from "#server/adapters/proxyRanges.ts";

export function trustedProxyRanges(trustedProxy?: string): string[] {
	return trustedProxy === undefined ? [] : (proxyRanges(trustedProxy) ?? []);
}
