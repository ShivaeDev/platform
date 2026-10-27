import { proxyRanges } from "./proxyRanges.ts";

export function trustedProxyRanges(trustedProxy?: string): string[] {
	return trustedProxy === undefined ? [] : (proxyRanges(trustedProxy) ?? []);
}
