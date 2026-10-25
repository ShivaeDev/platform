import { Option, Result } from "effect";
import * as NetAddress from "effect/net/NetAddress";

function parsedProxyRange(entry: string) {
	const parts = entry.split("/");
	const address = parts[0] ?? "";
	const parsed = NetAddress.ipFromString(address);
	if (Result.isFailure(parsed) || parts.length > 2) {
		return undefined;
	}
	const ip = parsed.success;
	const prefix = parts[1];
	if (prefix !== undefined && (!/^\d+$/u.test(prefix) || Number(prefix) > NetAddress.width(ip))) {
		return undefined;
	}
	return { ip, prefix };
}

function normalizedProxyRange(entry: string): string[] | undefined {
	const parsed = parsedProxyRange(entry);
	if (parsed === undefined) {
		return undefined;
	}
	const { ip, prefix } = parsed;
	if (NetAddress.isIpv4Address(ip)) {
		return [entry];
	}
	const ipv4 = Option.getOrUndefined(NetAddress.fromIpv4Mapped(ip));
	const bits = prefix === undefined ? 128 : Number(prefix);
	if (ipv4 !== undefined) {
		if (bits >= 96) {
			const mapped = NetAddress.formatIp(ipv4);
			return [prefix === undefined ? mapped : `${mapped}/${bits - 96}`];
		}
		const network = bits <= 80 ? "::" : `::${((0xff_ff << (96 - bits)) & 0xff_ff).toString(16)}:0:0`;
		return [`${network}/${bits}`, "0.0.0.0/0"];
	}
	const value = NetAddress.ipv6ToSegments(ip).reduce((accumulator, segment) => (accumulator << 16n) | BigInt(segment), 0n);
	const shift = BigInt(128 - bits);
	return bits < 96 && value >> shift === 0xff_ff_0000_0000n >> shift ? [entry, "0.0.0.0/0"] : [entry];
}

export function proxyRanges(value: string): string[] | undefined {
	const ranges: string[] = [];
	for (const entry of value.split(",")) {
		const normalized = normalizedProxyRange(entry.trim());
		if (normalized === undefined) {
			return undefined;
		}
		ranges.push(...normalized);
	}
	return ranges;
}
