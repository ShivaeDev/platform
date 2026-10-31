import { Effect } from "effect";
import { clientConnection } from "#clientConnection.ts";
import { LocalPostgresError } from "#LocalPostgresError.ts";
import type { docker as runDocker } from "#localDocker.ts";
import { PostgresCommandError } from "#PostgresCommandError.ts";
import type { CommandOptions } from "#runCommand.ts";

export const POSTGRES_IMAGE = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";
const CONTAINER = "development-postgres";
type Docker = (args: readonly string[], options?: CommandOptions) => ReturnType<typeof runDocker>;

export const sqlInContainer = Effect.fn("LocalPostgres.sqlInContainer")(function* (
	docker: Docker,
	url: URL,
	args: readonly string[],
	options: CommandOptions,
) {
	const id = yield* docker(["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], options);
	if (!id || id.includes("\n")) {
		return yield* new PostgresCommandError({ command: "psql", message: "Install psql or start the shared PostgreSQL service with Docker." });
	}
	if ((yield* docker(["inspect", "--format", "{{.Config.Image}}", id], options)) !== POSTGRES_IMAGE) {
		return yield* new LocalPostgresError({
			message: "The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.",
		});
	}
	const { url: inside, options: settings } = clientConnection(url, options);
	inside.hostname = "127.0.0.1";
	inside.port = "5432";
	return yield* docker(["exec", "--env", "PGPASSWORD", id, "psql", ...args, "--dbname", inside.toString()], settings);
});

export const startContainer = Effect.fn("LocalPostgres.startContainer")(function* (docker: Docker) {
	yield* docker(["info"]);
	const existing = yield* docker(["container", "ls", "--all", "--filter", `name=^/${CONTAINER}$`, "--format", "{{.ID}}"]);
	if (existing) {
		if ((yield* docker(["inspect", "--format", "{{.Config.Image}}", CONTAINER])) !== POSTGRES_IMAGE) {
			return yield* new LocalPostgresError({
				message: "The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.",
			});
		}
		yield* docker(["start", CONTAINER]);
	} else {
		yield* docker([
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
			POSTGRES_IMAGE,
		]);
	}
});
