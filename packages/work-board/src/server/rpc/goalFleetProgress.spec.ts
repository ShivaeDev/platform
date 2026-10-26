import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";

for (const [stage, group] of [
	["working", "running"],
	["reviewing", "running"],
	["waiting", "blocked"],
] as const) {
	boardStory.it(
		`counts live progress while Fleet reports ${stage} through the goals RPC`,
		[projectFiles({ ...goalPageFixture(), "asks.md": "# No open asks" }), deferredServing],
		function* ({ start, connectClient }) {
			const missing = { cause: "Not configured for fixture", observedAt: 0, state: "not-configured" as const };
			const fleet = goalFleetFixture(stage);
			const daemon = yield* diagnosticsDaemon(
				() => ({ codex: missing, fleet: missing, github: missing }),
				0,
				() => fleet,
			);
			yield* start({ fleetPort: daemon.port });
			const client = connectClient();
			const result = yield* Effect.promise(() => client.read(client.api.goals.query()));
			const goal = result.goals.find((entry) => entry.id === "project.example");
			expect(goal?.counts).toEqual({ blocked: 0, done: 2, parked: 2, running: 0, scheduled: 0, [group]: 1 });
			expect(goal?.criteria[0]?.counts).toEqual({ blocked: 0, done: 1, parked: 0, running: 0, scheduled: 0, [group]: 1 });
			expect(goal?.criteria[1]?.counts).toEqual({ blocked: 0, done: 0, parked: 0, running: 0, scheduled: 0 });
		},
	);
}
