import { execFileSync } from "node:child_process";

const image = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";
const container = "development-postgres";
export const localServer = "postgresql://postgres:postgres@127.0.0.1:55432";

export function assertLocalDatabase(value, names) {
	const url = new URL(value);
	const name = url.pathname.slice(1);
	if (
		!["postgres:", "postgresql:"].includes(url.protocol) ||
		!["localhost", "127.0.0.1"].includes(url.hostname) ||
		url.port !== "55432" ||
		["host", "hostaddr", "port", "dbname", "service"].some((key) => url.searchParams.has(key)) ||
		!names.includes(name)
	)
		throw new Error(`Use a local database on 127.0.0.1:55432 named ${names.join(" or ")}.`);
	return url;
}

export function sql(url, query) {
	url = new URL(url);
	for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) url.searchParams.delete(key);

	const args = ["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", query];
	const options = { env: { ...process.env, PGDATABASE: String(url), PGCONNECT_TIMEOUT: "3" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
	try {
		return execFileSync("psql", [...args, "--dbname", String(url)], options).trim();
	} catch (error) {
		if (error.code !== "ENOENT") throw new Error(error.stderr?.toString() ?? "PostgreSQL query failed.");
		const id = execFileSync("docker", ["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], options).trim();
		if (!id || id.includes("\n")) throw new Error("Install psql or start the shared PostgreSQL service with Docker.");
		const configuredImage = execFileSync("docker", ["inspect", "--format", "{{.Config.Image}}", id], options).trim();
		if (configuredImage !== image)
			throw new Error("The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.");
		const inside = new URL(url);
		inside.hostname = "127.0.0.1";
		inside.port = "5432";
		return execFileSync("docker", ["exec", id, "psql", ...args, "--dbname", inside.toString()], {
			...options,
			env: { ...options.env, PGDATABASE: inside.toString() },
		}).trim();
	}
}

export function startPostgres(connection = localServer) {
	const server = new URL(connection);
	server.pathname = "/postgres";
	let version;
	try {
		version = sql(server, "SHOW server_version");
	} catch {
		const docker = (args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
		docker(["info"]);
		let existing = false;
		try {
			docker(["container", "inspect", container]);
			existing = true;
		} catch {}
		if (existing) {
			if (docker(["inspect", "--format", "{{.Config.Image}}", container]) !== image)
				throw new Error("The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.");
			docker(["start", container]);
		} else {
			docker([
				"run",
				"--detach",
				"--name",
				container,
				"--publish",
				"127.0.0.1:55432:5432",
				"--env",
				"POSTGRES_USER=postgres",
				"--env",
				"POSTGRES_PASSWORD=postgres",
				"--mount",
				"type=volume,src=development-postgres,dst=/var/lib/postgresql",
				image,
			]);
		}
		for (let attempt = 0; attempt < 30; attempt++) {
			try {
				version = sql(server, "SHOW server_version");
				break;
			} catch {
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
			}
		}
	}
	if (version !== "18.6") throw new Error("Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.");
}

export function prepareDatabases(values) {
	startPostgres(values[0]);
	for (const value of values) {
		const url = new URL(value);
		const name = url.pathname.slice(1);
		const server = new URL(url);
		server.pathname = "/postgres";
		if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("Invalid local database name.");
		if (!sql(server, `SELECT 1 FROM pg_database WHERE datname = '${name}'`)) sql(server, `CREATE DATABASE "${name}"`);
	}
}
