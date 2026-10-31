import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetWorkspace, fleetWorkspaceItems } from "#test/fleetWorkspaceFixture.ts";
import { nowScreen } from "#test/nowScreen.tsx";
import { nowFleet } from "#test/nowWork.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenFleet, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { workTableScreen } from "#test/workTableScreen.ts";
import { WorkNow } from "./WorkNow.tsx";

expectNoReactWarnings();

const BY_TITLE = ["Draft the pricing page", "Fix the flaky upload test", "Ship the onboarding email", "Write the install guide"];
const UPLOAD = ["Fix the flaky upload test"];
const BY_OWNER_DESC = { order: "desc", sort: "owner", view: "table" };

screenStory.it(
	"The Table sorts by title and reverses the order when the reader clicks Work again",
	[workTableScreen("/_board/work?view=table")],
	function* ({ sortTableBy, tableSort, tableTitles, workAddress }) {
		yield* outcomes({
			sort: [tableSort(), { column: "Work", order: "ascending" }],
			titles: [tableTitles(), BY_TITLE],
		});

		yield* sortTableBy("Work");

		yield* outcomes({
			address: [workAddress(), { order: "desc", sort: "title", view: "table" }],
			sort: [tableSort(), { column: "Work", order: "descending" }],
			titles: [tableTitles(), [...BY_TITLE].reverse()],
		});
	},
);

screenStory.it(
	"The Table sorts by owner from the first owner when the reader clicks Owner",
	[workTableScreen("/_board/work?view=table&order=desc")],
	function* ({ sortTableBy, tableSort, tableTitles, workAddress }) {
		expect(yield* tableSort()).toEqual({ column: "Work", order: "descending" });

		yield* sortTableBy("Owner");

		yield* outcomes({
			address: [workAddress(), { sort: "owner", view: "table" }],
			sort: [tableSort(), { column: "Owner", order: "ascending" }],
			titles: [tableTitles(), ["Ship the onboarding email", "Write the install guide", "Fix the flaky upload test", "Draft the pricing page"]],
		});
	},
);

screenStory.it(
	"Each Table row is headed by a link named for its title that opens the item, with its ID beside it",
	[workTableScreen("/_board/work?view=table")],
	function* ({ tableRows }) {
		expect(yield* tableRows()).toEqual(
			[
				["task.pricing", "Draft the pricing page"],
				["task.upload", "Fix the flaky upload test"],
				["task.email", "Ship the onboarding email"],
				["task.guide", "Write the install guide"],
			].map(([id, title]) => ({ current: false, id, idShown: id, link: { name: title, opens: id }, selected: false, title })),
		);
	},
);

screenStory.it(
	"Find work narrows the Table to matching work and offers Reset",
	[workTableScreen("/_board/work?view=table")],
	function* ({ findWork, tableTitles, workAddress, workFilterReset }) {
		yield* outcomes({
			reset: [workFilterReset(), "not offered"],
			titles: [tableTitles(), BY_TITLE],
		});

		yield* findWork("upload");

		yield* outcomes({
			address: [workAddress(), { q: "upload", sort: "title", view: "table" }],
			reset: [workFilterReset(), "offered"],
			titles: [tableTitles(), UPLOAD],
		});
	},
);

screenStory.it(
	"Reset clears the text filter and shows all work again",
	[workTableScreen("/_board/work?view=table&q=upload")],
	function* ({ resetWorkFilters, tableTitles, workFilterReset }) {
		yield* outcomes({
			reset: [workFilterReset(), "offered"],
			titles: [tableTitles(), UPLOAD],
		});

		yield* resetWorkFilters();

		yield* outcomes({
			reset: [workFilterReset(), "not offered"],
			titles: [tableTitles(), BY_TITLE],
		});
	},
);

screenStory.it(
	"Saving the sorted Table as a view offers a link that opens it with the same order",
	[workTableScreen("/_board/work?view=table&sort=owner&order=desc")],
	function* ({ savedViews, saveTableView }) {
		expect(yield* savedViews()).toEqual({ chosen: "No saved views", opens: "nothing" });

		yield* saveTableView("By owner");

		expect(yield* savedViews()).toEqual({ chosen: "By owner", opens: BY_OWNER_DESC });
	},
);

screenStory.it(
	"Choosing a saved view again offers its link again",
	[workTableScreen("/_board/work?view=table&sort=owner&order=desc")],
	function* ({ chooseSavedView, savedViews, saveTableView }) {
		yield* saveTableView("By owner");
		yield* chooseSavedView("Choose a saved view");
		expect(yield* savedViews()).toEqual({ chosen: "Choose a saved view", opens: "nothing" });

		yield* chooseSavedView("By owner");

		expect(yield* savedViews()).toEqual({ chosen: "By owner", opens: BY_OWNER_DESC });
	},
);

screenStory.it(
	"Remove deletes the chosen saved view",
	[workTableScreen("/_board/work?view=table&sort=owner&order=desc")],
	function* ({ removeChosenView, savedViews, saveTableView }) {
		yield* saveTableView("By owner");
		expect(yield* savedViews()).toEqual({ chosen: "By owner", opens: BY_OWNER_DESC });

		yield* removeChosenView();

		expect(yield* savedViews()).toEqual({ chosen: "No saved views", opens: "nothing" });
	},
);

screenStory.it(
	"Now lays out its lanes in workflow order",
	[nowScreen(6, WorkNow, nowFleet(3, Effect.runSync(Clock.currentTimeMillis)))],
	function* ({ nowLanes }) {
		expect(yield* nowLanes()).toEqual([
			"Queued: 1",
			"Working: 1",
			"Reviewing: 1",
			"Waiting on you: 0",
			"Waiting on orchestrator: 0",
			"Waiting on automation: 0",
			"Done in the last 7 days: 1",
		]);
	},
);

screenStory.it(
	"Now announces unavailable Fleet data in one alert above the lanes",
	[nowScreen(6, WorkNow, { reason: "Fleet is offline.", state: "unavailable" })],
	function* ({ fleetAlert }) {
		expect(yield* fleetAlert()).toEqual(["Lanes show the status written in each file. Fleet is offline."]);
	},
);

screenStory.it(
	"A phone shows one Now lane at a time and switches lanes from the lane tabs",
	[screenMedia(["(max-width: 767px)"]), nowScreen(6, WorkNow, nowFleet(3, Effect.runSync(Clock.currentTimeMillis)))],
	function* ({ chooseLaneTab, phoneLane }) {
		expect(yield* phoneLane()).toEqual({ cards: ["task-0"], lanes: ["Queued"], tabs: "Lanes" });

		yield* chooseLaneTab("Reviewing 1");

		expect(yield* phoneLane()).toEqual({ cards: ["task-2"], lanes: ["Reviewing"], tabs: "Lanes" });
	},
);

screenStory.it(
	"All work heads each status group with a badge counting its cards",
	[workTableScreen("/_board/work?view=board")],
	function* ({ allWorkGroups }) {
		expect(yield* allWorkGroups()).toEqual([
			{ badge: "2", cards: ["task.pricing", "task.guide"], group: "Draft" },
			{ badge: "2", cards: ["task.upload", "task.email"], group: "Ready" },
		]);
	},
);

for (const [route, name] of [
	["/_board/work", "Now"],
	["/_board/work?view=board", "All work"],
	["/_board/work?view=table", "Table"],
] as const) {
	screenStory.it(`${name} names itself in the page heading and its pressed layout tab`, [workTableScreen(route)], function* ({ workLayout }) {
		expect(yield* workLayout()).toEqual({ chosen: name, heading: name });
	});
}

screenStory.it(
	"The sidebar counts the same open tasks the Now lanes show",
	[
		screenFiles(
			{ ...fleetWorkspace, "tasks/later.md": "---\nid: task.later\nkind: task\nstatus: draft\n---\n# Plan the later work\n" },
			{ home: "home.md" },
		),
		screenFleet(fleetWorkspaceItems(Effect.runSync(Clock.currentTimeMillis))),
		screenRoute("/_board/work"),
		openScreen(),
	],
	function* ({ navigationLabels, workItems }) {
		yield* outcomes({
			navigation: [navigationLabels(), expect.arrayContaining(["Now, 4 open tasks"])],
			"work in the lanes": [workItems(), ["task.pricing", "task.guide", "task.upload", "task.email"]],
		});
	},
);

screenStory.it(
	"The Owner menu narrows All work to that owner's work",
	[workTableScreen("/_board/work?view=board")],
	function* ({ chooseInToolbar, toolbarChoice, workAddress, workItems }) {
		yield* outcomes({
			owner: [toolbarChoice("Owner"), "All owners"],
			"work shown": [workItems(), ["task.pricing", "task.guide", "task.upload", "task.email"]],
		});

		yield* chooseInToolbar("Owner", "marvin");

		yield* outcomes({
			address: [workAddress(), { owner: "value:marvin", sort: "title", view: "board" }],
			owner: [toolbarChoice("Owner"), "marvin"],
			"work shown": [workItems(), ["task.pricing"]],
		});
	},
);

screenStory.it(
	"The Sort by menu sorts All work and keeps its owner filter",
	[workTableScreen("/_board/work?view=board&owner=value:marvin")],
	function* ({ chooseInToolbar, toolbarChoice, workAddress }) {
		expect(yield* toolbarChoice("Sort by")).toBe("Title");

		yield* chooseInToolbar("Sort by", "Owner");

		yield* outcomes({
			address: [workAddress(), { owner: "value:marvin", sort: "owner", view: "board" }],
			"sort by": [toolbarChoice("Sort by"), "Owner"],
		});
	},
);

screenStory.it(
	"The toolbar keeps an unavailable board and an unmatched status visible",
	[workTableScreen("/_board/work?view=table&board=board.missing&status=value:paused")],
	function* ({ toolbarChoice }) {
		yield* outcomes({
			board: [toolbarChoice("Board"), "board.missing (unavailable)"],
			status: [toolbarChoice("Status"), "Paused (no current matches)"],
		});
	},
);

screenStory.it(
	"The Table marks the selected item's row and its title link",
	[workTableScreen("/_board/work?view=table&item=task.upload")],
	function* ({ tableSelection }) {
		expect(yield* tableSelection()).toEqual({ current: UPLOAD, selected: ["task.upload"] });
	},
);
