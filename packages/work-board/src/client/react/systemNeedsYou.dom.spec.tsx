import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { fleetHealth, unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

for (const [state, workspace, shown] of [
	["every workspace file is readable", [], "3"],
	["a workspace file cannot be read", [unreadableHome()], "Unavailable"],
] as const) {
	screenStory.it(
		`System's Fleet card shows Today's Needs you count instead of Fleet's maintainer count when ${state}`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), ...workspace, fleetHealth(health), screenRoute("/_board/system"), openScreen()],
		function* ({ systemCard }) {
			expect(yield* systemCard("fleet")).toEqual(
				expect.objectContaining({
					facts: {
						"Last provider capacity rejection": expect.anything(),
						"Last scheduler pass": expect.anything(),
						"Needs you": shown,
						Queued: expect.anything(),
						"Running / concurrency cap": expect.anything(),
						"Waiting on automation": expect.anything(),
						"Waiting on orchestrator": expect.anything(),
					},
				}),
			);
		},
	);
}
