import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
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
		`shows Today's Needs you count on System instead of Fleet's maintainer count when ${state}`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), ...workspace, fleetHealth(health), screenRoute("/_board/system"), openScreen()],
		function* ({ findElements, readText }) {
			yield* eventually(() => expect(readText("[data-needs-you] strong")).toBe(shown));
			expect(findElements('[data-source="fleet"] dt').map((term) => term.textContent)).toEqual([
				"Running / concurrency cap",
				"Queued",
				"Needs you",
				"Waiting on orchestrator",
				"Waiting on automation",
				"Last scheduler pass",
				"Last provider capacity rejection",
			]);
			expect(readText('[data-source="fleet"]')).not.toContain("maintainer");
		},
	);
}
