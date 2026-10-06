import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { sqlInContainer, startContainer } from "./local-container.ts";
import { type DockerEnvironment, docker } from "./local-docker.ts";

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

export function localPostgres(environment: DockerEnvironment) {
	function localDocker(args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding = { encoding: "utf8" }) {
		return docker(environment, args, options);
	}
	function sql(value: string | URL, query: string) {
		const url = new URL(value);
		assertLocalDatabase(url.toString(), [url.pathname.slice(1)]);
		for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) {
			url.searchParams.delete(key);
		}

		const args = ["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", query];
		if (!url.searchParams.has("connect_timeout")) {
			url.searchParams.set("connect_timeout", "3");
		}
		const options = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] } satisfies ExecFileSyncOptionsWithStringEncoding;
		try {
			return execFileSync("psql", [...args, "--dbname", String(url)], options).trim();
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
				throw new Error(error instanceof Error && "stderr" in error ? String(error.stderr) : "PostgreSQL query failed.");
			}
			return sqlInContainer(localDocker, url, args, options);
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
			for (let attempt = 0; attempt < 30; attempt++) {
				try {
					version = sql(server, "SHOW server_version");
					break;
				} catch {
					Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
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
