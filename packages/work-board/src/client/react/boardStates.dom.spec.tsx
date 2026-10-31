import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardDocumentScreen } from "#test/boardDocumentScreen.tsx";
import { heldWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen, chromeScreen, openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";
import { searchScreen } from "#test/searchScreen.tsx";
import { DocumentMain } from "./DocumentMain.tsx";

expectNoReactWarnings();

for (const { label, shape, url } of [
	{ label: "Loading Today", shape: "today", url: "/" },
	{ label: "Loading Goals", shape: "cards", url: "/_board/goals" },
	{ label: "Loading Now", shape: "lanes", url: "/_board/work" },
	{ label: "Loading All work", shape: "table", url: "/_board/work?view=table" },
	{ label: "Loading Library", shape: "rows", url: "/_board/library" },
	{ label: "Loading System", shape: "cards", url: "/_board/system" },
]) {
	screenStory.it(
		`${url} holds a ${shape}-shaped skeleton until its data arrives`,
		[todayScreen(), screenRoute(url), heldWorkspace(), openScreen()],
		function* ({ loadingState, mainHeading, releaseWorkspace }) {
			yield* outcomes({
				heading: [mainHeading(), "no heading"],
				loading: [loadingState(), { shape, skeletons: "shown", status: label }],
			});

			yield* releaseWorkspace();

			yield* outcomes({
				heading: [mainHeading(), expect.not.stringMatching(/^no heading$/u)],
				loading: [loadingState(), "not loading"],
			});
		},
	);
}

screenStory.it(
	"A board document holds a lanes-shaped skeleton while its lanes load",
	[
		heldWorkspace(),
		boardDocumentScreen({ "board.md": "---\nid: board.held\nitems: []\n---\n# Held board\n", "home.md": "# Home" }, "/board.md", { home: "home.md" }),
	],
	function* ({ loadingState }) {
		expect(yield* loadingState()).toEqual({ shape: "lanes", skeletons: "shown", status: "Loading board" });
	},
);

screenStory.it(
	"An empty Today says what fills Needs you and Goals and where to go next",
	[routedScreen({}, "/")],
	function* ({ emptyState, loadingState }) {
		yield* outcomes({
			goals: [
				emptyState("Today goals"),
				expect.objectContaining({ action: { href: "/_board/goals", label: "All goals" }, title: "No active goals" }),
			],
			loading: [loadingState(), "not loading"],
			"needs you": [
				emptyState("Needs you"),
				{
					action: { href: "/_board/start", label: "Getting started" },
					description: "Questions and reviews from your agents appear here when they need your answer.",
					title: "Nothing needs you",
				},
			],
		});
	},
);

screenStory.it(
	"Now shows one empty state instead of empty lanes when the workspace declares no work",
	[routedScreen({ "notes.md": "# Notes" }, "/_board/work")],
	function* ({ emptyState, nowLanes }) {
		yield* outcomes({
			empty: [
				emptyState("work results"),
				expect.objectContaining({ action: { href: "/_board/start", label: "Getting started" }, title: "No work yet" }),
			],
			lanes: [nowLanes(), []],
		});
	},
);

screenStory.it(
	"A board that lists no work offers All work",
	[routedScreen({ "board.md": "---\nid: board.empty\nitems: []\n---\n# Empty board\n" }, "/_board/work?view=board&board=board.empty")],
	function* ({ emptyState }) {
		expect(yield* emptyState("work results")).toEqual(
			expect.objectContaining({ action: expect.objectContaining({ href: "/_board/work?view=board&sort=title" }), title: "No work on this board" }),
		);
	},
);

const work = {
	"task.md": "---\nid: task.build\nkind: task\nstatus: ready\n---\n# Build the page\n",
};

screenStory.it(
	"A table filtered to no rows becomes a No matching work state whose link clears the filters",
	[routedScreen(work, "/_board/work?view=table&q=nothing-matches")],
	function* ({ emptyState, tableRows }) {
		yield* outcomes({
			empty: [
				emptyState("work results"),
				expect.objectContaining({
					action: { href: "/_board/work?view=table&sort=title#work-results", label: "Clear filters" },
					title: "No matching work",
				}),
			],
			rows: [tableRows(), []],
		});
	},
);

screenStory.it("Now names what fills each empty lane", [routedScreen(work, "/_board/work")], function* ({ nowLane }) {
	yield* outcomes({
		queued: [nowLane("Queued"), expect.objectContaining({ cards: ["task.build"], empty: "none" })],
		reviewing: [nowLane("Reviewing"), expect.objectContaining({ empty: expect.objectContaining({ title: "Nothing in review" }) })],
		"waiting on you": [nowLane("Waiting on you"), expect.objectContaining({ empty: expect.objectContaining({ title: "Nothing waiting on you" }) })],
		working: [
			nowLane("Working"),
			expect.objectContaining({ empty: { description: "Work an agent is building appears here.", title: "Nothing working" } }),
		],
	});
});

screenStory.it("An empty Library says what fills it", [routedScreen({}, "/_board/library")], function* ({ emptyState }) {
	expect(yield* emptyState()).toEqual(
		expect.objectContaining({ action: { href: "/_board/start", label: "Getting started" }, title: "No documents yet" }),
	);
});

screenStory.it(
	"Show all documents clears Library filters that match nothing",
	[routedScreen({ ...work, "notes.md": "---\nstatus: done\n---\n# Closed notes\n" }, "/_board/library")],
	function* ({ emptyState, filterLibrary, followEmptyState, libraryTitles }) {
		yield* filterLibrary("Kind", "Task");
		yield* filterLibrary("Status", "Done");
		expect(yield* emptyState()).toEqual(
			expect.objectContaining({ action: expect.objectContaining({ label: "Show all documents" }), title: "No matching documents" }),
		);

		yield* followEmptyState();

		yield* outcomes({
			empty: [emptyState(), "no empty state"],
			titles: [libraryTitles(), ["Closed notes", "Build the page"]],
		});
	},
);

screenStory.it(
	"A goal with no criteria and no linked work says so instead of showing progress",
	[
		boardScreen(
			{ "bare.md": "---\nid: project.bare\nkind: goal\nstatus: draft\n---\n# Empty goal\n", "home.md": "# Home" },
			(api) => <DocumentMain api={api} onPage={() => undefined} url="/bare.md" />,
			{ home: "home.md" },
		),
	],
	function* ({ emptyState, goalPageProgress, goalPageStateCounts, linkedWork }) {
		yield* outcomes({
			criteria: [emptyState("criteria"), expect.objectContaining({ title: "No criteria" })],
			"linked work": [emptyState("linked work"), expect.objectContaining({ title: "No linked work" })],
			"linked work groups": [linkedWork(), {}],
			progress: [goalPageProgress(), "no progress bar"],
			"state counts": [goalPageStateCounts(), []],
		});
	},
);

screenStory.it("The sidebar names each empty list", [chromeScreen({ "notes/plan.md": "# Plan\n" }, "/_board/library")], function* ({ emptyState }) {
	yield* outcomes({
		"active goals": [emptyState("sidebar Active goals"), expect.objectContaining({ title: "No active goals" })],
		pinned: [emptyState("sidebar Pinned"), expect.objectContaining({ description: "Pin a document to keep it here.", title: "No pinned documents" })],
	});
});

screenStory.it(
	"Reading history says when nothing has been read yet",
	[chromeScreen({ "notes/plan.md": "# Plan\n" }, "/_board/library")],
	function* ({ emptyState, openReadingHistory }) {
		yield* openReadingHistory();

		expect(yield* emptyState("reading history")).toEqual(expect.objectContaining({ title: "No reading history" }));
	},
);

screenStory.it(
	"Search with no matches offers to include files Fleet writes",
	[searchScreen({ "notes.md": "# Notes\n\nPlain text." }, { home: undefined })],
	function* ({ emptyState, followEmptyState, searchFor, searchIncludesFleetFiles }) {
		yield* searchFor("zzzz");
		yield* outcomes({
			empty: [
				emptyState("search"),
				{
					action: { label: "Include files Fleet writes" },
					description: "Nothing in this workspace matches “zzzz”. Try fewer or different words.",
					title: "No matches",
				},
			],
			"includes Fleet files": [searchIncludesFleetFiles(), false],
		});

		yield* followEmptyState("search");

		expect(yield* searchIncludesFleetFiles()).toBe(true);
	},
);

screenStory.it(
	"A result without review or feedback says nothing was requested",
	[
		routedScreen(
			{ "README.md": "# Workspace\n", "result.md": "---\nid: result.bare\nkind: report\nstatus: done\n---\n# A bare result\n" },
			"/_board/item/result.bare/",
		),
	],
	function* ({ resultReviewNote }) {
		expect(yield* resultReviewNote()).toBe("No review requested, no checks listed and no feedback yet.");
	},
);

screenStory.it(
	"An item without handoffs says none were made",
	[
		routedScreen(
			{ "README.md": "# Workspace\n", "task.md": "---\nid: task.handoff\nkind: task\nstatus: draft\n---\n# A task\n" },
			"/_board/handoff?item=task.handoff",
		),
	],
	function* ({ emptyState }) {
		expect(yield* emptyState("handoff history")).toEqual(expect.objectContaining({ title: "No handoffs yet" }));
	},
);
