import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { criteriaTask, mergedTask, pullRequestFleet } from "#test/readingAidsFixture.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenHeaderLayout } from "#test/screenHeaderLayout.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemSummary } from "./ItemSummary.tsx";

expectNoReactWarnings();

const REPORT = `---
id: report.long
kind: report
---
# Long report

Opening summary.

## Findings

Body.

### First finding

Body.

## Next steps

Body.
`;
const SECTIONS = ["#heading-long-report", "#heading-findings", "#heading-first-finding", "#heading-next-steps"];
const report = readingPage({ "home.md": "# Home", "report.md": REPORT }, "/report.md");

screenStory.it("a report's outline lists its sections in the item context, outside the Details and Source tabs", [report], function* ({ outline }) {
	expect(yield* outline()).toEqual({ links: SECTIONS, within: "the item context" });
});

screenStory.it("the On this page menu near the top lists the report's sections", [report], function* ({ openOutlineMenu, outlineMenu }) {
	expect(yield* outlineMenu()).toBe("closed");

	yield* openOutlineMenu();

	expect(yield* outlineMenu()).toEqual(SECTIONS);
});

screenStory.it(
	"choosing a section in the On this page menu closes the menu and stays on the report",
	[report],
	function* ({ address, chooseOutlineSection, openOutlineMenu, outlineMenu, shownPage }) {
		yield* openOutlineMenu();
		expect(yield* outlineMenu()).toEqual(SECTIONS);

		yield* chooseOutlineSection("#heading-next-steps");

		yield* outcomes({
			address: [address(), "/report.md"],
			menu: [outlineMenu(), "closed"],
			page: [shownPage(), "Long report"],
		});
	},
);

screenStory.it(
	"a document without sections has no outline and no On this page menu",
	[readingPage({ "home.md": "# Home", "note.md": "---\nid: note.short\nkind: report\n---\n# Short note\n\nOne paragraph.\n" }, "/note.md")],
	function* ({ outline, outlineMenu }) {
		yield* outcomes({
			menu: [outlineMenu(), "none"],
			outline: [outline(), "none"],
		});
	},
);

screenStory.it(
	"scrolling a report shrinks its pinned header to the title while the layout keeps the header's full height",
	[screenHeaderLayout(145, 53), report],
	function* ({ headerHeightsInLayout, headerState, headerTitle, scrollReading }) {
		expect(yield* headerState()).toBe("expanded");

		yield* scrollReading(400);

		yield* outcomes({
			header: [headerState(), "compact"],
			"header heights in the layout": [headerHeightsInLayout(), [145]],
			title: [headerTitle(), "Long report"],
		});
	},
);

screenStory.it(
	"the header of an unidentified note stays expanded while the reader scrolls",
	[readingPage({ "home.md": "# Home", "note.md": "# Plain note\n\n## Section\n\nBody.\n" }, "/note.md")],
	function* ({ headerState, scrollReading }) {
		yield* scrollReading(400);

		expect(yield* headerState()).toBe("expanded");
	},
);

screenStory.it(
	"a header written in the document body stays in the text and does not become a page header",
	[readingPage({ "home.md": "# Home", "note.md": "# Signed note\n\n## Sign-off\n\n<header>Reviewed by the team</header>\n" }, "/note.md")],
	function* ({ bodyHeaders, headerTitles }) {
		yield* outcomes({
			"headers in the text": [bodyHeaders(), ["Reviewed by the team"]],
			"page headers": [headerTitles(), ["Signed note"]],
		});
	},
);

screenStory.it(
	"a criterion's inline Markdown renders as code, bold text and links",
	[readingPage({ "home.md": "# Home", "task.md": criteriaTask(["Run `pnpm lint` and **pass**", "See [the guide](guide.md)"]) }, "/task.md")],
	function* ({ criterionMarkup }) {
		yield* outcomes({
			c1: [criterionMarkup("c1"), { code: ["pnpm lint"], links: [], strong: ["pass"], text: "c1: Run pnpm lint and pass" }],
			c2: [criterionMarkup("c2"), { code: [], links: [["the guide", "/guide.md"]], strong: [], text: "c2: See the guide" }],
		});
	},
);

for (const [count, criteria, place] of [
	[2, ["One", "Two"], "the Details tab of the item context"],
	[4, ["One", "Two", "Three", "Four"], "the main column after the body"],
] as const) {
	screenStory.it(
		`a task with ${count} criteria lists them in ${place}`,
		[readingPage({ "home.md": "# Home", "task.md": criteriaTask(criteria) }, "/task.md")],
		function* ({ criteriaList }) {
			expect(yield* criteriaList()).toEqual({ criteria: criteria.map((_, index) => `c${index + 1}`), place });
		},
	);
}

screenStory.it(
	"a criteria list in the main column has its own outline entry",
	[readingPage({ "home.md": "# Home", "task.md": criteriaTask(["One", "Two", "Three", "Four"]) }, "/task.md")],
	function* ({ outlineEntry }) {
		expect(yield* outlineEntry("#criteria")).toBe("Criteria and recorded evidence");
	},
);

screenStory.it(
	"pull request numbers in a next action link to the one repository Fleet works in",
	[
		componentScreen(
			<FleetItemsContext.Provider value={pullRequestFleet("https://github.com/example/project/pull/1")}>
				<ItemSummary document={mergedTask} />
			</FleetItemsContext.Provider>,
		),
	],
	function* ({ itemFieldLinks, itemFields }) {
		yield* outcomes({
			fields: [itemFields(), "Owner: marvin · Next action: Done; PR #764 merged after PR 12."],
			links: [
				itemFieldLinks(),
				[
					["PR #764", "https://github.com/example/project/pull/764"],
					["PR 12", "https://github.com/example/project/pull/12"],
				],
			],
		});
	},
);

for (const [name, value] of [
	["Fleet is unavailable", { reason: "Not configured", state: "unavailable" } as const],
	["Fleet works in two repositories", pullRequestFleet("https://github.com/example/project/pull/1", "https://github.com/example/other/pull/2")],
] as const) {
	screenStory.it(
		`pull request numbers in a next action stay plain text when ${name}`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={value}>
					<ItemSummary document={mergedTask} />
				</FleetItemsContext.Provider>,
			),
		],
		function* ({ itemFieldLinks }) {
			expect(yield* itemFieldLinks()).toEqual([]);
		},
	);
}
