import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";

for (const [stage, _group] of [
	["working", "ready"],
	["reviewing", "ready"],
	["waiting", "deferred"],
] as const) {
	boardStory.it(
		`keeps authored counts while Fleet reports ${stage} through the goals RPC`,
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
			const held = { deferred: 1, ready: 0 };
			expect(goal?.counts).toEqual({ done: 1, ...held, draft: 3, dropped: 0 });
			expect(goal?.criteria[0]?.counts).toEqual({ deferred: 0, done: 0, draft: 2, dropped: 0, ready: 0 });
			expect(goal?.criteria[1]?.counts).toEqual({ deferred: 0, done: 0, draft: 0, dropped: 0, ready: 0 });
		},
	);
}
