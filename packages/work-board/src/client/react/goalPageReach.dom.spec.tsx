import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

const quiet: Readonly<Record<string, string>> = { ...goalPageFixture(), "asks.md": "# No open asks" };
const executing = goalFleetFixture("working");
const RUN_UPDATED = 4_102_444_800_000;

screenStory.it(
	"a goal with two open asks offers them behind one control that lists a link to each",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ goalAskLinks, goalOpenAsks, openGoalAsks }) {
		yield* outcomes({
			control: [goalOpenAsks(), "2 open asks"],
			"listed asks": [goalAskLinks(), []],
		});

		yield* openGoalAsks();

		expect(yield* goalAskLinks()).toEqual(["/_board/item/decision.review/#answer-card-goal", "/_board/item/decision.review/#answer-card-task"]);
	},
);

screenStory.it(
	"draft work waiting on an open ask counts as blocked yet stays in the Draft group with a Needs you chip",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ goalPageStateCounts, linkedWorkRow }) {
		yield* outcomes({
			"fifth task": [linkedWorkRow("task.fifth"), expect.objectContaining({ group: "Draft" })],
			"first task": [linkedWorkRow("task.first"), expect.objectContaining({ group: "Draft", states: ["Draft", "Needs you"] })],
			"linked work by state": [goalPageStateCounts(), expect.arrayContaining(["2 blocked"])],
		});
	},
);

screenStory.it(
	"a goal without open asks shows its zero counts quietly and offers no asks control",
	[boardScreen(quiet, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ goalOpenAsks, goalPageStateCounts }) {
		yield* outcomes({
			"linked work by state": [goalPageStateCounts(), ["1 done", "0 running (quiet)", "0 blocked (quiet)", "0 scheduled (quiet)", "4 parked"]],
			"open asks": [goalOpenAsks(), "none"],
		});
	},
);

screenStory.it(
	"a goal page keeps Ready work open and folds its quiet linked work groups and each criterion's list of linked items",
	[
		boardScreen({ ...quiet, "second.md": quiet["second.md"]?.replace("status: draft", "status: ready") ?? "" }, (api) => (
			<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
		)),
	],
	function* ({ criterionCard, linkedWork, linkedWorkFolded }) {
		yield* outcomes({
			"first criterion": [criterionCard("first"), expect.objectContaining({ linkedItems: "2 linked items", work: "folded" })],
			"folded groups": [linkedWorkFolded(), ["Draft", "Done", "Deferred"]],
			groups: [linkedWork(), expect.objectContaining({ Ready: ["task.second"] })],
		});
	},
);

screenStory.it(
	"ready linked work shows who holds it and when Fleet last changed it, with its link as the row's only Tab stop",
	[
		boardScreen(
			{ ...quiet, "first.md": quiet["first.md"]?.replace("kind: task", "kind: task\nowner: codex").replace("status: draft", "status: ready") ?? "" },
			(api) => (
				<FleetItemsContext.Provider
					value={{ ...executing, items: executing.items.map((run) => (run.workId === "task.first" ? { ...run, updatedAt: RUN_UPDATED } : run)) }}
				>
					<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
				</FleetItemsContext.Provider>
			),
		),
	],
	function* ({ linkedWorkRow }) {
		expect(yield* linkedWorkRow("task.first")).toEqual(
			expect.objectContaining({
				group: "Ready",
				owner: "codex",
				tabStops: ["/_board/item/task.first/", "https://github.com/example/project/pull/1"],
				updated: String(RUN_UPDATED),
			}),
		);
	},
);
