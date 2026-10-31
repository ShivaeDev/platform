import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetWorkspace, fleetWorkspaceItems } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenFleet, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const now = [
	screenFiles(fleetWorkspace, { home: "home.md" }),
	screenFleet(fleetWorkspaceItems(Effect.runSync(Clock.currentTimeMillis))),
	screenRoute("/_board/work"),
	openScreen(),
];

screenStory.it("Each Now card says in plain words who holds it and how long it has been in its stage", now, function* ({ nowCard }) {
	yield* outcomes({
		email: [nowCard("task.email"), expect.objectContaining({ kind: "none", owner: "Waiting on your answer", stage: "Waiting, started 4h ago" })],
		guide: [nowCard("task.guide"), expect.objectContaining({ kind: "none", owner: "Queued for Fleet", stage: "Queued 4h ago" })],
		pricing: [nowCard("task.pricing"), expect.objectContaining({ kind: "none", owner: "Assigned to you", stage: "none" })],
		upload: [nowCard("task.upload"), expect.objectContaining({ kind: "none", owner: "Fleet is working on this", stage: "Working, started 4h ago" })],
	});
});

screenStory.it("A Now card's links are its only Tab stops", now, function* ({ nowCard }) {
	expect(yield* nowCard("task.upload")).toEqual(
		expect.objectContaining({ tabStops: [expect.stringContaining("item=task.upload"), expect.stringContaining("/pull/")] }),
	);
});
