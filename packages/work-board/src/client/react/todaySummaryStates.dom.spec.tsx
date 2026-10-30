import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { pendingFleet, unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles } from "#test/screenWorkspaceTraits.ts";
import { todaySummaryScreen } from "#test/todaySummaryScreen.tsx";

expectNoReactWarnings();

for (const [workspace, summaries, loading] of [
	["pending", [], ["Loading work in progress", "Loading goals"]],
	["failed", ["Goals unavailable"], ["Loading work in progress"]],
] as const) {
	screenStory.it(
		`names the Today summaries it cannot count and holds a skeleton for the one still loading while workspace indexing is ${workspace}`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), ...(workspace === "failed" ? [pendingFleet()] : []), todaySummaryScreen(workspace)],
		function* ({ findElements, readText }) {
			yield* eventually(() => expect(findElements(".today-strip a").map((link) => link.textContent)).toEqual(["3 need you", ...summaries]));
			expect(findElements('.today-strip [role="status"][aria-busy="true"]').map((status) => status.textContent)).toEqual(loading);
			expect(findElements('.today-strip [data-slot="skeleton"]').map((skeleton) => skeleton.closest("[role=status]")?.textContent)).toEqual(loading);
			expect(readText(".today-strip")).not.toContain("…");
		},
	);
}

screenStory.it(
	"says Needs you is unavailable in the Today summary while a workspace file cannot be read",
	[screenFiles(fleetWorkspace, { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ readText }) {
		yield* eventually(() => expect(readText(".today-strip a")).toBe("Needs you unavailable"));
		expect(readText(".today-strip")).not.toContain("?");
	},
);
