import { BlockList, isIP } from "node:net";
import { Schema } from "effect";
import { addProxyAddress, proxyRanges as normalizedRanges } from "./proxyRanges.ts";

export function proxyRanges(value: string): string[] | undefined {
	return normalizedRanges(value);
}

export function proxyAddresses(value: string): BlockList | undefined {
	const addresses = new BlockList();
	return proxyRanges(value)?.every((entry) => addProxyAddress(addresses, entry)) ? addresses : undefined;
}
export const TrustedProxy = Schema.String.check(
	Schema.makeFilter((value) => proxyAddresses(value) !== undefined, {
		message: "Expected a comma-separated list of IPv4 or IPv6 addresses or CIDR ranges",
	}),
);
export function proxyMatches(addresses: BlockList, address: string): boolean {
	const unmapped = address.replace(/^::ffff:(?=\d+\.)/iu, "");
	const family = isIP(unmapped);
	return family !== 0 && !unmapped.includes("%") && addresses.check(unmapped, family === 4 ? "ipv4" : "ipv6");
}
