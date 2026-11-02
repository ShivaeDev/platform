import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { environmentGate } from "#test/environmentGate.ts";
import { postgresDefinition } from "#test/postgres.ts";

export const dockerStories = storyKit({
	...postgresDefinition,
	name: "Docker postgres",
	runIf: environmentGate("a local Docker daemon", "docker", ["--host=unix:///var/run/docker.sock", "info"]),
});
