import type { PgPoolConfig } from "@effect/sql-pg/PgClient";
import { Redacted } from "effect";

function isDecodableHost(hostname: string): boolean {
	const runs = hostname.match(/(?:%[\da-f]{2})+/giu) ?? [];
	if (hostname.replace(/(?:%[\da-f]{2})+/giu, "").includes("%")) {
		return false;
	}
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	return runs.every((run) => {
		const bytes = Uint8Array.from(run.match(/[\da-f]{2}/giu) ?? [], (byte) => Number.parseInt(byte, 16));
		const decoded = encoder.encode(decoder.decode(bytes));
		return decoded.length === bytes.length && decoded.every((byte, index) => byte === bytes[index]);
	});
}

export function databaseAddress(value: Redacted.Redacted<string>): Pick<PgPoolConfig, "host" | "port"> {
	const address = Redacted.value(value);
	if (!URL.canParse(address)) {
		return {};
	}
	const url = new URL(address);
	if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
		return {};
	}
	const rawHostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
	if (!isDecodableHost(rawHostname)) {
		return {};
	}
	const hostname = decodeURIComponent(rawHostname);
	// PgConnection applies query parameters in order, after the authority.
	const host = url.searchParams.getAll("host").at(-1) ?? hostname;
	const rawPort = url.searchParams.getAll("port").at(-1) ?? url.port;
	const port = rawPort === "" ? undefined : Number(rawPort);
	if (host.includes(",") || (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65_535))) {
		return {};
	}
	return {
		...(host === "" && !url.searchParams.has("host") ? {} : { host }),
		...(port === undefined ? {} : { port }),
	};
}
