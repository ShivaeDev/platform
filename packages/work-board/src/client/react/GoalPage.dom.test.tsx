import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { goalFleetReports } from "#test/goalTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

const GOAL_PAGE = "/_board/item/project.example/";
const fixture = goalPageFixture();
const quiet = { ...fixture, "asks.md": "# No open asks" };

for (const [stage, label, counted] of [
	["working", "Working", "running"],
	["reviewing", "Reviewing", "running"],
	["waiting", "Waiting", "blocked"],
] as const) {
	screenStory.it(
		`a draft task Fleet reports as ${stage} counts as ${counted} on its goal page and shows ${label} in the Draft group`,
		[goalFleetReports(stage), routedScreen(quiet, GOAL_PAGE, { home: "home.md" })],
		function* ({ criterionCard, goalPageStateCounts, linkedWorkRow }) {
			yield* outcomes({
				"first criterion": [criterionCard("first"), expect.objectContaining({ progress: `1 done · 1 ${counted}` })],
				"first task's row": [linkedWorkRow("task.first"), expect.objectContaining({ group: "Draft", states: [label] })],
				"linked work by state": [
					goalPageStateCounts(),
					[
						"2 done",
						counted === "running" ? "1 running" : "0 running (quiet)",
						counted === "blocked" ? "1 blocked" : "0 blocked (quiet)",
						"0 scheduled (quiet)",
						"2 parked",
					],
				],
			});
		},
	);
}

screenStory.it(
	"a goal page shows its progress between its introduction and the goal's prose",
	[goalFleetReports("working"), routedScreen(quiet, GOAL_PAGE, { home: "home.md" })],
	function* ({ goalPageParts }) {
		expect(yield* goalPageParts()).toEqual(["introduction", "progress", "prose"]);
	},
);

screenStory.it(
	"a linked work row links to the pull request Fleet recorded, and a row without one leaves its PR cell empty",
	[
		goalFleetReports("working", (fleet) => ({
			...fleet,
			items: fleet.items.map((item) => (item.workId === "task.third" ? { ...item, stage: "working" } : item)),
		})),
		routedScreen(
			{
				...quiet,
				"first.md": (fixture["first.md"] ?? "").replace("status: draft", "status: ready"),
				"third.md": (fixture["third.md"] ?? "").replace("status: deferred", "status: ready"),
			},
			GOAL_PAGE,
			{ home: "home.md" },
		),
	],
	function* ({ linkedWorkColumns, linkedWorkRow }) {
		yield* outcomes({
			"first task's PR": [linkedWorkRow("task.first"), expect.objectContaining({ pr: "https://github.com/example/project/pull/1" })],
			"ready columns": [linkedWorkColumns("Ready"), ["Work", "Criteria", "State", "Owner", "Updated", "PR"]],
			"third task's PR": [linkedWorkRow("task.third"), expect.objectContaining({ pr: "empty" })],
		});
	},
);

screenStory.it(
	"a goal without an id says progress needs a unique id and lists no linked work",
	[routedScreen({ ...goalPageFixture(), "unnamed.md": "---\nkind: goal\nstatus: draft\n---\n# Unnamed goal" }, "/unnamed.md", { home: "home.md" })],
	function* ({ goalProgressNotice, linkedWork }) {
		yield* outcomes({
			"linked work": [linkedWork(), {}],
			progress: [goalProgressNotice(), "Progress is available for uniquely identified goals."],
		});
	},
);
