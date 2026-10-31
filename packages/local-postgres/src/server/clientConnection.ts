import type { CommandOptions } from "#runCommand.ts";

export function clientConnection(value: URL, options: CommandOptions = {}) {
	const url = new URL(value);
	// libpq treats + literally in URI passwords.
	const password = new URLSearchParams(url.search.replaceAll("+", "%2B")).getAll("password").at(-1) ?? decodeURIComponent(url.password);
	url.password = "";
	for (const key of ["password", "schema", "connection_limit", "pool_timeout", "pgbouncer"]) {
		url.searchParams.delete(key);
	}
	if (!url.searchParams.has("connect_timeout")) {
		url.searchParams.set("connect_timeout", "3");
	}
	return { options: { ...options, env: { ...options.env, ...(password && { "PGPASSWORD": password }) }, extendEnv: true }, url };
}
