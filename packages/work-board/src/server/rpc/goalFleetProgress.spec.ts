import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";

for (const stage of ["executing", "reviewing", "needs-human"] as const) {
	boardStory.it(
		"counts Fleet %s as in progress through the goals RPC",
		[projectFiles(goalPageFixture()), deferredServing],
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
			expect(goal?.counts).toEqual({ done: 2, "in progress": 1, planned: 2 });
			expect(goal?.criteria[0]?.counts).toEqual({ done: 1, "in progress": 1, planned: 0 });
			expect(goal?.criteria[1]?.counts).toEqual({ done: 0, "in progress": 0, planned: 0 });
		},
	);
}
