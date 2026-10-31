import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { boardWithFleet } from "#test/liveTraits.ts";

const none = { blocked: 0, done: 0, parked: 0, running: 0, scheduled: 0 };

for (const [stage, group] of [
	["working", "running"],
	["reviewing", "running"],
	["waiting", "blocked"],
] as const) {
	boardStory.it(
		`while Fleet reports a task ${stage}, the goals query counts it as ${group} for the goal and its criterion`,
		[projectFiles({ ...goalPageFixture(), "asks.md": "# No open asks" }), boardWithFleet(() => goalFleetFixture(stage), "not configured")],
		function* ({ goalDetail }) {
			expect(yield* goalDetail("project.example")).toMatchObject({
				counts: { ...none, done: 2, parked: 2, [group]: 1 },
				criteria: [{ counts: { ...none, done: 1, [group]: 1 } }, { counts: none }],
			});
		},
	);
}
