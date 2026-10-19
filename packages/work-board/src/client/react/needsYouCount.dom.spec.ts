import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { fleetHealth, screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, openScreen } from "#test/screenTraits.ts";
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
	"counts In progress on Today from the task files while Fleet is unavailable and says where the status comes from",
	[screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements(".today-strip a").map((link) => link.textContent)).toEqual([
					"3 need you",
					"1 in progress in task files",
					"0 active goals",
				]),
			),
		);
		expect(findElements("[data-progress-id]").map((row) => row.getAttribute("data-progress-id"))).toEqual(["task.upload"]);
		expect(readText("[data-progress-id='task.upload']")).toBe("Fix the flaky upload testTask file · Active");
		expect(findElements("#in-progress [role='status'] p").map((line) => line.textContent)).toEqual([
			"Fleet unavailable. Fleet daemon is not configured for this Board",
			"Status comes from the task files, not live Fleet.",
		]);
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
					"Now, 3 open tasks",
					"Library",
					"System",
				]),
			),
		);
		expect(readAttribute("#inbox-topbar", "aria-label")).toBe("Today, 3 need you");
		expect(readAttribute("#inbox-count", "aria-label")).toBe("3 need you");
	},
);

const PHONE_TODAY = 'nav[aria-label="Phone navigation"] a[href="/"]';
screenStory.it(
	"shows the sidebar's needs-you count as a badge on the phone's Today tab",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ findElement, readAttribute, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#inbox-count")).toBe("3")));
		expect(roles.accessible(findElement(PHONE_TODAY) ?? document.body).name).toBe(readAttribute("#home-open", "aria-label"));
		expect(readAttribute(PHONE_TODAY, "aria-label")).toBe("Today, 3 need you");
		expect(readText(`${PHONE_TODAY} [data-slot="badge"]`)).toBe("3");
		expect([readAttribute("#inbox-count", "data-variant"), readAttribute(`${PHONE_TODAY} [data-slot="badge"]`, "data-variant")]).toEqual([
			"default",
			"default",
		]);
	},
);

screenStory.it(
	"leaves the phone's Today tab without a badge when nothing needs you",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen({ "notes/plan.md": "# Plan\n" })],
	function* ({ findElement, readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#inbox-count")).toBe("0")));
		expect(readAttribute(PHONE_TODAY, "aria-label")).toBe("Today, 0 need you");
		expect(findElement(`${PHONE_TODAY} [data-slot="badge"]`)).toBeNull();
		expect(readAttribute("#inbox-count", "data-variant")).toBe("secondary");
	},
);
