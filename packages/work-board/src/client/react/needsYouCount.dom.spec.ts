import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { fleetHealth } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"counts what needs you on System by the same rule and label as Today",
	[screenFiles(fleetWorkspace, { home: "home.md" }), fleetHealth(health), screenRoute("/_board/system"), openScreen()],
	function* ({ findElements, navigate, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("[data-needs-you] strong")).toBe("3")));
		expect(readText("[data-needs-you] dt")).toBe("Needs you");
		yield* Effect.promise(() => navigate("/"));
		yield* Effect.promise(() => eventually(() => expect(readText(".today-strip a")).toBe("3 need you")));
		expect(findElements('ul[aria-label="Needs you"] > li')).toHaveLength(3);
	},
);

screenStory.it(
	"says Fleet is unavailable on Today instead of showing an unknown in-progress count",
	[screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements(".today-strip a").map((link) => link.textContent)).toEqual(["3 need you", "Fleet unavailable", "0 active goals"]),
			),
		);
		expect(readText(".today-strip")).not.toContain("?");
	},
);

screenStory.it(
	"names every workspace destination and the counts beside them",
	[screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ findElements, readAttribute }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements("#primary-navigation a").map((link) => link.getAttribute("aria-label"))).toEqual([
					"Today, 3 need you",
					"Goals",
					"Now, 4 open tasks",
					"Library",
					"System",
				]),
			),
		);
		expect(readAttribute("#inbox-topbar", "aria-label")).toBe("Today, 3 need you");
		expect(readAttribute("#inbox-count", "aria-label")).toBe("3 need you");
	},
);
