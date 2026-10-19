import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createConnectionEngine } from "#test/createConnectionEngine.ts";

export const connections = storyKit({
	clock: "live",
	create: createConnectionEngine,
	name: "shared PostgreSQL connections",
	stages: ["container"],
	verbs: (engine, story) => ({
		containerId: () => engine.docker(["inspect", "--format", "{{.Id}}", engine.name]),
		execute: (query: string) => engine.manager.sql(`${engine.server}/postgres`, query),
		start: (connection?: string) => {
			story.tell("start the shared PostgreSQL service");
			return Effect.try({ catch: (error) => error, try: () => engine.manager.startPostgres(connection) });
		},
		startedAt: () => engine.docker(["inspect", "--format", "{{.State.StartedAt}}", engine.name]),
	}),
});

export function stockContainer(limit?: number) {
	return connections.trait("container", `a running stock PostgreSQL container${limit ? ` configured for ${limit} connections` : ""}`, (engine) => {
		engine.startStock();
		if (limit) {
			engine.manager.sql(`${engine.server}/postgres`, `ALTER SYSTEM SET max_connections = ${limit}`);
			engine.docker(["restart", engine.name]);
			engine.wait();
		}
	});
}
