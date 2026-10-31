import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { pageButton, pageLink } from "#test/shellExpectations.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();

for (const { title, url } of [
	{ title: "Goals", url: "/_board/goals" },
	{ title: "Now", url: "/_board/work" },
	{ title: "Library", url: "/_board/library" },
	{ title: "System", url: "/_board/system" },
	{ title: "First active goal", url: "/_board/item/project.alpha/" },
	{ title: "Workspace notes", url: "/home.md" },
]) {
	screenStory.it(
		`opens ${url} from Today under one page header titled ${title}`,
		[chromeScreen(todayFixture(), "/")],
		function* ({ navigate, pageAddress, pageHeaders }) {
			expect(yield* pageHeaders()).toEqual(["Today"]);

			yield* navigate(url);

			yield* outcomes([
				["the headers", () => pageHeaders(), [title]],
				["the page", () => pageAddress(), url],
			]);
		},
	);
}

for (const { actions, files, name, url } of [
	{
		actions: [
			pageButton("Pin"),
			pageLink("Prepare an agent handoff", "/_board/handoff?item=request.search"),
			pageLink("Respond to this request", "/_board/item/request.search/#answer-card-keyboard-review"),
			pageLink("Reviewed item", "/_board/item/request.search/"),
		],
		files: attentionFixture(),
		name: "a returned result",
		url: "/attention/review.md",
	},
	{
		actions: [
			pageButton("Pin"),
			pageButton("Change your answer"),
			pageButton("Clear selections"),
			pageLink("Open PR #395", "https://github.com/ShivaeDev/platform/pull/395"),
		],
		files: answeredDecisionFixture(),
		name: "an answered decision",
		url: `/_board/item/${decisionId}/`,
	},
]) {
	screenStory.it(
		`shows the actions on ${name} as links to a page and buttons that act in place`,
		[routedScreen(files, url, { writable: true })],
		function* ({ actionControls }) {
			yield* outcomes([
				[
					"the links without a page",
					() => actionControls(),
					expect.not.arrayContaining([pageLink(expect.any(String), expect.not.stringMatching(/^(?:\/|https:\/\/)/u))]),
				],
				["the named actions", () => actionControls(), expect.arrayContaining(actions)],
			]);
		},
	);
}

screenStory.it(
	"scrolls a System hash link to the section it names",
	[
		observedBrowserMotion(),
		screenFiles({ ...fleetWorkspace, "notes/extra.md": "---\nid: note.extra\nflavor: sweet\n---\n# Extra fields\n" }, { home: "home.md" }),
		screenRoute("/_board/system#source-problems"),
		openScreen(),
	],
	function* ({ readPassageTargets }) {
		expect(yield* readPassageTargets()).toContain("source-problems");
	},
);

screenStory.it(
	"links each sidebar destination and the Now, All work and Table layouts to their pages, marking Now as current",
	[chromeScreen(todayFixture(), "/_board/work")],
	function* ({ destinationLinks, workLayoutLinks }) {
		yield* outcomes([
			[
				"the destinations",
				() => destinationLinks(),
				[
					{ href: "/", label: "Today" },
					{ href: "/_board/goals", label: "Goals" },
					{ href: "/_board/work", label: "Now" },
					{ href: "/_board/pull-requests", label: "Pull requests" },
					{ href: "/_board/library", label: "Library" },
					{ href: "/_board/system", label: "System" },
				],
			],
			[
				"the layouts",
				() => workLayoutLinks(),
				[
					{ current: "page", href: "/_board/work?view=now&sort=title#work-results", name: "Now" },
					{ current: "no", href: "/_board/work?view=board&sort=title#work-results", name: "All work" },
					{ current: "no", href: "/_board/work?view=table&sort=title#work-results", name: "Table" },
				],
			],
		]);
	},
);

screenStory.it(
	"links an answer card's pull request to its page",
	[routedScreen(readyDecisionFixture, "/guide.md", { home: "home.md" })],
	function* ({ linkTarget }) {
		expect(yield* linkTarget("Open PR #395")).toBe("https://github.com/ShivaeDev/platform/pull/395");
	},
);
