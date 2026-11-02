import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { environmentGate } from "#test/environmentGate.ts";
import { postgresDefinition } from "#test/postgres.ts";
import { SERVER } from "#test/postgresEngine.ts";

export const sharedPostgres = storyKit({
	...postgresDefinition,
	name: "shared postgres",
	runIf:
		environmentGate("the local PostgreSQL service and host psql", "psql", ["-X", "--dbname", SERVER, "-c", "SELECT 1"])
		&& environmentGate("a local Docker daemon", "docker", ["--host=unix:///var/run/docker.sock", "info"]),
});
