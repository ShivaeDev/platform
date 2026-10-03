import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";

const image = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";
const container = "development-postgres";
type Docker = (args: readonly string[], options?: ExecFileSyncOptionsWithStringEncoding) => string;

export function sqlInContainer(docker: Docker, url: URL, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) {
	const id = docker(["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], options).trim();
	if (!id || id.includes("\n")) {
		throw new Error("Install psql or start the shared PostgreSQL service with Docker.");
	}
	if (docker(["inspect", "--format", "{{.Config.Image}}", id], options).trim() !== image) {
		throw new Error("The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.");
	}
	const inside = new URL(url);
	inside.hostname = "127.0.0.1";
	inside.port = "5432";
	return docker(["exec", id, "psql", ...args, "--dbname", inside.toString()], options).trim();
}

export function startContainer(docker: Docker) {
	docker(["info"]);
	let existing = false;
	try {
		docker(["container", "inspect", container]);
		existing = true;
	} catch {}
	if (existing) {
		if (docker(["inspect", "--format", "{{.Config.Image}}", container]).trim() !== image) {
			throw new Error("The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.");
		}
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
}
