import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { env } from "node:process";
import { sqlInContainer, startContainer } from "./localContainer.ts";
import { type DockerEnvironment, docker } from "./localDocker.ts";

export const localServer = "postgresql://postgres:postgres@127.0.0.1:55432";

export function assertLocalDatabase(value: string, names: readonly string[]) {
	const url = new URL(value);
	const name = url.pathname.slice(1);
	if (
		!(["postgres:", "postgresql:"].includes(url.protocol) && ["localhost", "127.0.0.1"].includes(url.hostname))
		|| url.port !== "55432"
		|| ["host", "hostaddr", "port", "dbname", "service"].some((key) => url.searchParams.has(key))
		|| !names.includes(name)
	) {
		throw new Error(`Use a local database on 127.0.0.1:55432 named ${names.join(" or ")}.`);
	}
	return url;
}

function clientEnvironment(url: URL) {
	// libpq treats + literally in URI passwords.
	const password = new URLSearchParams(url.search.replaceAll("+", "%2B")).getAll("password").at(-1) ?? decodeURIComponent(url.password);
	return { ...env, ...(password && { "PGPASSWORD": password }) };
}

export interface ReadinessOptions {
	readonly attempts?: number;
	readonly delayMillis?: number;
}

export function localPostgres(environment: DockerEnvironment, { attempts = 30, delayMillis = 1000 }: ReadinessOptions = {}) {
	function localDocker(args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding = { encoding: "utf8" }) {
		return docker(environment, args, options);
	}
	function sql(value: string | URL, query: string) {
		const url = new URL(value);
		assertLocalDatabase(url.toString(), [url.pathname.slice(1)]);
		const childEnvironment = clientEnvironment(url);
		url.password = "";
		url.searchParams.delete("password");
		for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) {
			url.searchParams.delete(key);
		}

		const args = ["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", query];
		if (!url.searchParams.has("connect_timeout")) {
			url.searchParams.set("connect_timeout", "3");
		}
		const options = {
			encoding: "utf8",
			env: childEnvironment,
			stdio: ["ignore", "pipe", "pipe"],
		} satisfies ExecFileSyncOptionsWithStringEncoding;
		try {
			return execFileSync("psql", [...args, "--dbname", url.toString()], options).trim();
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				return sqlInContainer(localDocker, url, args, options);
			}
			throw new Error(error instanceof Error && "stderr" in error ? String(error.stderr) : "PostgreSQL query failed.", { cause: error });
		}
	}

	function startPostgres(connection = localServer) {
		const server = new URL(connection);
		server.pathname = "/postgres";
		assertLocalDatabase(server.toString(), ["postgres"]);
		let version: string | undefined;
		try {
			version = sql(server, "SHOW server_version");
		} catch {
			startContainer(localDocker);
			for (let attempt = 0; attempt < attempts; attempt += 1) {
				try {
					version = sql(server, "SHOW server_version");
					break;
				} catch {
					Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMillis);
				}
			}
		}
		if (version !== "18.6") {
			throw new Error("Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.");
		}
	}

	function prepareDatabases(values: readonly string[]) {
		for (const value of values) {
			const name = new URL(value).pathname.slice(1);
			assertLocalDatabase(value, [name]);
			if (!/^[a-z][a-z0-9_]{0,62}$/u.test(name)) {
				throw new Error("Invalid local database name.");
			}
		}
		startPostgres(values[0]);
		for (const value of values) {
			const url = new URL(value);
			const name = url.pathname.slice(1);
			const server = new URL(url);
			server.pathname = "/postgres";
			if (!sql(server, `SELECT 1 FROM pg_database WHERE datname = '${name}'`)) {
				sql(server, `CREATE DATABASE "${name}"`);
			}
		}
	}
	return { prepareDatabases, sql, startPostgres };
}
