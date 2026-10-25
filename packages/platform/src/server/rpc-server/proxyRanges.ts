import { BlockList, isIP } from "node:net";

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
function mappedIpv4(address: string): string | undefined {
	const groups = /^\[::ffff:(?<high>[\da-f]+):(?<low>[\da-f]+)\]$/u.exec(new URL(`http://[${address}]`).hostname)?.groups;
	if (groups?.high === undefined || groups.low === undefined) {
		return undefined;
	}
	const high = Number.parseInt(groups.high, 16);
	const low = Number.parseInt(groups.low, 16);
	return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
}
function normalizedProxyRange(entry: string): string[] | undefined {
	const range = new BlockList();
	if (!addProxyAddress(range, entry)) {
		return undefined;
	}
	const [address = "", prefix] = entry.split("/");
	if (isIP(address) !== 6) {
		return [entry];
	}
	const ipv4 = mappedIpv4(address);
	const bits = prefix === undefined ? 128 : Number(prefix);
	if (ipv4 !== undefined) {
		if (bits >= 96) {
			return [prefix === undefined ? ipv4 : `${ipv4}/${bits - 96}`];
		}
		const network = bits <= 80 ? "::" : `::${((0xff_ff << (96 - bits)) & 0xff_ff).toString(16)}:0:0`;
		return [`${network}/${bits}`, "0.0.0.0/0"];
	}
	return bits < 96 && range.check("::ffff:0:0", "ipv6") ? [entry, "0.0.0.0/0"] : [entry];
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
