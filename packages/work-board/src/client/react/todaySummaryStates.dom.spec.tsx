import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { pendingFleet, unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles } from "#test/screenWorkspaceTraits.ts";
import { todaySummaryScreen } from "#test/todaySummaryScreen.tsx";

expectNoReactWarnings();

for (const [workspace, summaries] of [
	["pending", ["Loading Fleet…", "Loading goals…"]],
	["failed", ["Loading Fleet…", "Goals unavailable"]],
] as const) {
	screenStory.it(
		`names the Today summaries it cannot count while workspace indexing is ${workspace}`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), ...(workspace === "failed" ? [pendingFleet()] : []), todaySummaryScreen(workspace)],
		function* ({ findElements }) {
			yield* Effect.promise(() =>
				eventually(() => expect(findElements(".today-strip a").map((link) => link.textContent)).toEqual(["3 need you", ...summaries])),
			);
		},
	);
}

screenStory.it(
	"says Needs you is unavailable in the Today summary while a workspace file cannot be read",
	[screenFiles(fleetWorkspace, { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(".today-strip a")).toBe("Needs you unavailable")));
		expect(readText(".today-strip")).not.toContain("?");
	},
);
