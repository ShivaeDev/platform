import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { health } from "#test/diagnostics.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { fleetHealth, screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const phone = screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]);

screenStory.it(
	"System counts what needs you by the same rule and label as Today",
	[screenFiles(fleetWorkspace, { home: "home.md" }), fleetHealth(health), screenRoute("/_board/system"), openScreen()],
	function* ({ navigate, needsYou, systemCard, todaySummaryParts }) {
		expect(yield* systemCard("fleet")).toEqual(expect.objectContaining({ facts: expect.objectContaining({ "Needs you": "3" }) }));

		yield* navigate("/");

		yield* outcomes([
			["needs you", () => needsYou(), ["Landing copy tone", "Ship the onboarding email", "Draft the pricing page"]],
			["summary", () => todaySummaryParts(), expect.arrayContaining(["3 need you → #needs-you"])],
		]);
	},
);

screenStory.it(
	"Today counts In progress from each task's written status while Fleet is unavailable and says so",
	[screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ inProgressList, todaySummaryParts }) {
		yield* outcomes([
			[
				"in progress",
				() => inProgressList(),
				expect.objectContaining({
					rows: [
						expect.objectContaining({ badge: "Ready", id: "task.email" }),
						expect.objectContaining({ badge: "Ready", id: "task.upload", title: "Fix the flaky upload test" }),
					],
					status: ["Fleet isn't set up for this Board.These show the status written in each task, not what Fleet reports."],
				}),
			],
			["summary", () => todaySummaryParts(), ["3 need you → #needs-you", "2 ready tasks → #in-progress", "0 active goals → #today-goals"]],
		]);
	},
);

screenStory.it(
	"The navigation names every workspace destination with the counts beside it",
	[screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ navigationLabels, needsYouBadges }) {
		yield* outcomes([
			[
				"badges",
				() => needsYouBadges(),
				expect.objectContaining({
					header: expect.objectContaining({ label: "Today, 3 need you" }),
					sidebar: expect.objectContaining({ label: "3 need you" }),
				}),
			],
			["navigation", () => navigationLabels(), ["Today, 3 need you", "Goals", "Now, 3 open tasks", "Pull requests", "Library", "System"]],
		]);
	},
);

screenStory.it(
	"The phone's Today tab carries the needs-you count as a badge",
	[phone, screenFiles(fleetWorkspace, { home: "home.md" }), openScreen()],
	function* ({ needsYouBadges }) {
		expect(yield* needsYouBadges()).toEqual(expect.objectContaining({ phone: { badge: "3", label: "Today, 3 need you" } }));
	},
);

screenStory.it(
	"The phone's Today tab has no badge when nothing needs you",
	[phone, chromeScreen({ "notes/plan.md": "# Plan\n" })],
	function* ({ needsYouBadges }) {
		expect(yield* needsYouBadges()).toEqual(expect.objectContaining({ phone: { badge: "none", label: "Today, 0 need you" } }));
	},
);

screenStory.it(
	"The sidebar and header keep a zero needs-you count for screen readers only",
	[chromeScreen({ "notes/plan.md": "# Plan\n" })],
	function* ({ needsYouBadges }) {
		expect(yield* needsYouBadges()).toEqual(
			expect.objectContaining({
				header: expect.objectContaining({ badge: { label: "0 need you", shown: "screen readers only" } }),
				sidebar: { label: "0 need you", shown: "screen readers only" },
			}),
		);
	},
);
