import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { env } from "node:process";

const IMAGE = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";
const CONTAINER = "development-postgres";
type Docker = (args: readonly string[], options?: ExecFileSyncOptionsWithStringEncoding) => string;

export function sqlInContainer(docker: Docker, url: URL, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) {
	const id = docker(["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], options).trim();
	if (!id || id.includes("\n")) {
		throw new Error("Install psql or start the shared PostgreSQL service with Docker.");
	}
	if (docker(["inspect", "--format", "{{.Config.Image}}", id], options).trim() !== IMAGE) {
		throw new Error("The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.");
	}
	const inside = new URL(url);
	inside.hostname = "127.0.0.1";
	inside.port = "5432";
	inside.password = "";
	try {
		return docker(["exec", "--env", "PGPASSWORD", id, "psql", ...args, "--dbname", inside.toString()], {
			...options,
			env: { ...env, ...options.env, ...(url.password && { "PGPASSWORD": decodeURIComponent(url.password) }) },
		}).trim();
	} catch (error) {
		throw new Error(error instanceof Error && "stderr" in error ? String(error.stderr) : "PostgreSQL query failed.", { cause: error });
	}
}

export function startContainer(docker: Docker) {
	docker(["info"]);
	let existing: boolean;
	try {
		docker(["container", "inspect", CONTAINER]);
		existing = true;
	} catch {
		existing = false;
	}
	if (existing) {
		if (docker(["inspect", "--format", "{{.Config.Image}}", CONTAINER]).trim() !== IMAGE) {
			throw new Error("The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.");
		}
		docker(["start", CONTAINER]);
	} else {
		docker([
			"run",
			"--detach",
			"--name",
			CONTAINER,
			"--publish",
			"127.0.0.1:55432:5432",
			"--env",
			"POSTGRES_USER=postgres",
			"--env",
			"POSTGRES_PASSWORD=postgres",
			"--mount",
			"type=volume,src=development-postgres,dst=/var/lib/postgresql",
			IMAGE,
		]);
	}
}
