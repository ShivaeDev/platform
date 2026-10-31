import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { goalsScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"a goal card shows the goal's done share, next action, open asks and the done share of each criterion work targets",
	[goalsScreen({ ...goalsFixture(), "claims.md": "" })],
	function* ({ goalCardFacts }) {
		expect(yield* goalCardFacts("project.example")).toEqual({
			criteria: ["First criterion 1/2", "Second criterion 0/1"],
			nextAction: "Review linked work",
			openAsks: "2 open asks",
			progress: "2/5 done",
			title: "Example goal",
		});
	},
);

screenStory.it(
	"a goal card without linked work, asks or a next action shows only its title",
	[goalsScreen({ ...goalsFixture(), "claims.md": "" })],
	function* ({ goalCardFacts }) {
		expect(yield* goalCardFacts("project.empty")).toEqual({
			criteria: [],
			nextAction: undefined,
			openAsks: undefined,
			progress: undefined,
			title: "Empty goal",
		});
	},
);

screenStory.it("a goal card links each criterion to its place on the goal page", [goalsScreen()], function* ({ goalCardLinks }) {
	expect(yield* goalCardLinks("project.example")).toEqual([
		"/_board/item/project.example/",
		"/_board/item/project.example/#criterion-first",
		"/_board/item/project.example/#criterion-second",
	]);
});

screenStory.it("a goal card's progress bar tells a screen reader the goal's counts", [goalsScreen()], function* ({ goalCardProgress }) {
	expect(yield* goalCardProgress("project.example")).toMatchObject({ spoken: "2 of 5 done, 2 done, 0 running, 1 blocked, 0 scheduled, 2 parked" });
});

screenStory.it("the Goals page folds deferred and closed goals into sections of their own", [goalsScreen()], function* ({ goalList }) {
	expect(yield* goalList()).toEqual({
		active: ["project.example"],
		closed: { ids: ["project.closed"], open: false },
		deferred: { ids: ["project.empty"], open: false },
	});
});

screenStory.it("the Goals page counts only its active goals in its summary", [goalsScreen()], function* ({ pageSummary }) {
	expect(yield* pageSummary()).toBe("1 active goal");
});

screenStory.it(
	"a workspace without goals gets the empty Goals state pointing to Getting started, with no summary or folded sections",
	[goalsScreen({})],
	function* ({ emptyState, goalList, pageSummary }) {
		yield* outcomes([
			[
				"empty state",
				() => emptyState(),
				{
					action: { href: "/_board/start", label: "Getting started" },
					description: "A goal appears here when a file in this workspace declares one.",
					title: "No active goals",
				},
			],
			["sections", () => goalList(), { active: [], closed: "no section", deferred: "no section" }],
			["summary", () => pageSummary(), "no summary"],
		]);
	},
);
