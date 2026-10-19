import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { decisionId } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();

const PAGE_TITLE = "#doc [data-page-header] > h1";

screenStory.it(
	"opens every destination, an item and a document under the same page header",
	[chromeScreen(todayFixture(), "/")],
	function* ({ navigate, readAttribute, readText, findElements }) {
		for (const [url, title] of [
			["/", "Today"],
			["/_board/goals", "Goals"],
			["/_board/work", "Now"],
			["/_board/library", "Library"],
			["/_board/system", "System"],
			["/_board/item/project.alpha/", "First active goal"],
			["/home.md", "Workspace notes"],
		] as const) {
			yield* Effect.promise(() => navigate(url));
			yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe(url)));
			yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe(title)));
			expect(findElements("#doc [data-page-header]")).toHaveLength(1);
		}
	},
);

const ACTION_CONTROLS = '#doc [data-slot="button"], #doc [data-slot="link-button"]';

function roleOf(element: Element) {
	return element.getAttribute("role") ?? (element.tagName === "A" && element.hasAttribute("href") ? "link" : element.tagName.toLowerCase());
}

for (const { name, files, url, open, actions } of [
	{
		actions: [
			["button", "Save favorite"],
			["link", "Prepare an agent handoff"],
			["link", "Review returned result"],
			["link", "Respond to this request"],
			["link", "Reviewed item"],
		],
		files: attentionFixture(),
		name: "a returned result",
		open: '[role="tab"]:nth-child(2)',
		url: "/attention/review.md",
	},
	{
		actions: [
			["button", "Save favorite"],
			["button", "Change your answer"],
			["button", "Clear selections"],
		],
		files: answeredDecisionFixture(),
		name: "an answered decision",
		open: "details[data-key='change-answer'] > summary",
		url: `/_board/item/${decisionId}/`,
	},
] as const) {
	screenStory.it(
		`shows the actions on ${name} as links that navigate and buttons that act in place`,
		[routedScreen(files, url, { writable: true })],
		function* ({ click, findElement, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElement(".item-summary")).not.toBeNull()));
			click(open);
			const controls = findElements(ACTION_CONTROLS).map((element) => [roleOf(element), element.textContent?.trim()]);
			for (const action of actions) {
				expect(controls).toContainEqual(action);
			}
			for (const element of findElements(ACTION_CONTROLS).filter((candidate) => roleOf(candidate) === "link")) {
				expect(element.getAttribute("href")).toMatch(/^\//u);
			}
		},
	);
}

screenStory.it(
	"lands a hash link on the System section it names",
	[
		observedBrowserMotion(),
		screenFiles({ ...fleetWorkspace, "notes/extra.md": "---\nid: note.extra\nflavor: sweet\n---\n# Extra fields\n" }, { home: "home.md" }),
		screenRoute("/_board/system#source-problems"),
		openScreen(),
	],
	function* ({ findElement, readPassageTargets }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-source-problem]")).not.toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readPassageTargets()).toContain("source-problems")));
	},
);
