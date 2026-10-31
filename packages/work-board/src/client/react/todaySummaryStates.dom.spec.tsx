import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles } from "#test/screenWorkspaceTraits.ts";
import { todaySummaryScreen } from "#test/todaySummaryScreen.tsx";

expectNoReactWarnings();

for (const [workspace, parts] of [
	["pending", ["3 need you → #needs-you", "Loading work in progress (loading)", "Loading goals (loading)"]],
	["failed", ["3 need you → #needs-you", "Fleet unavailable → #in-progress", "Goals unavailable → #today-goals"]],
] as const) {
	screenStory.it(
		`while workspace indexing is ${workspace}, Today's summary holds a skeleton for each count still loading and names each count it cannot make`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), todaySummaryScreen(workspace)],
		function* ({ todaySummaryParts }) {
			expect(yield* todaySummaryParts()).toEqual(parts);
		},
	);
}

screenStory.it(
	"Today's summary says Needs you is unavailable while a workspace file cannot be read",
	[screenFiles(fleetWorkspace, { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ todaySummaryParts }) {
		expect(yield* todaySummaryParts()).toEqual(expect.arrayContaining(["Needs you unavailable → #needs-you"]));
	},
);
