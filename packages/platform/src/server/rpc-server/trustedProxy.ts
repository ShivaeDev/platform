import { BlockList, isIP } from "node:net";
import { Schema } from "effect";
import { proxyRanges as normalizedRanges } from "./proxyRanges.ts";

function addProxyAddress(addresses: BlockList, entry: string): boolean {
	const parts = entry.trim().split("/");
	const address = parts[0] ?? "";
	const family = isIP(address);
	if (family === 0 || address.includes("%") || parts.length > 2) {
		return false;
	}
	const type = family === 4 ? "ipv4" : "ipv6";
	const prefix = parts[1];
	if (prefix === undefined) {
		addresses.addAddress(address, type);
	} else {
		if (!/^\d+$/u.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)) {
			return false;
		}
		addresses.addSubnet(address, Number(prefix), type);
	}
	return true;
}
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
