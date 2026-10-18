import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenQuery, unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

for (const [failing, loading, summaries] of [
	["fleetItems", "goals", ["Fleet unavailable", "Loading goals…"]],
	["goals", "fleetItems", ["Loading Fleet…", "Goals unavailable"]],
] as const) {
	screenStory.it(
		`names the Today summaries it cannot count when ${failing} fails before ${loading} loads`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), screenQuery(failing, "failed"), screenQuery(loading, "pending"), openScreen()],
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
