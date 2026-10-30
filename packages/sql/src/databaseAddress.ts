import type { PgPoolConfig } from "@effect/sql-pg/PgClient";
import { Redacted } from "effect";

export function databaseAddress(value: Redacted.Redacted<string>): Pick<PgPoolConfig, "host" | "port"> {
	try {
		const url = new URL(Redacted.value(value));
		if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
			return {};
		}
		const hostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : decodeURIComponent(url.hostname);
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
	} catch {
		return {};
	}
}
