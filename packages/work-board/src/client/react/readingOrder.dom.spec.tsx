import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const goal = { ...goalPageFixture(), "home.md": "# Home" };
const documents = {
	"home.md": "# Home",
	"notes/first.md": "# First\n\n[Earlier](earlier.md) and [Next](next.md)\n",
	"notes/next.md": "# Next\n",
	"notes/plain.md": "# Plain\n\n## Section\n\nText.\n",
	"notes/record.md": "---\nid: report.record\nkind: report\n---\n# Record\n",
};

screenStory.it(
	"Tab passes through a goal's progress, criteria, linked work groups and text before its item context",
	[readingPage(goal, "/goal.md")],
	function* ({ tabOrder, tabStopsIn }) {
		yield* outcomes({
			"linked work": [tabStopsIn("Linked work"), ["button Draft (3)", "button Done (1)", "button Deferred (1)"]],
			order: [
				tabOrder(),
				[
					"the page header",
					"Item overview",
					"the page header",
					"Progress",
					"Criteria and recorded evidence",
					"Linked work",
					"the document text",
					"Item context",
					"Document outline",
				],
			],
		});
	},
);

screenStory.it(
	"a goal page names its overview, progress, each open ask, criteria, linked work, item context and outline as landmarks",
	[readingPage(goal, "/goal.md")],
	function* ({ landmarks }) {
		expect(yield* landmarks()).toEqual([
			"Item overview",
			"Progress",
			"Answer: Example goal",
			"Answer: Example goal",
			"Criteria and recorded evidence",
			"Linked work",
			"Item context",
			"Document outline",
		]);
	},
);

screenStory.it("a goal's outline links each of its sections to the section's anchor", [readingPage(goal, "/goal.md")], function* ({ outline }) {
	expect(yield* outline()).toEqual({
		links: [
			"#heading-example-goal",
			"#progress",
			"#by-criterion",
			"#answer-title-decision.review/criterion",
			"#answer-title-decision.review/goal",
			"#criteria",
			"#linked-work",
			"#heading-why-this-goal-matters",
		],
		within: "the item context",
	});
});

screenStory.it(
	"a shared link to a goal's Linked work lands focus on that section without a missing-section notice",
	[readingPage(goal, "/goal.md#linked-work")],
	function* ({ navigationStatus, readerFocus }) {
		yield* outcomes({
			focus: [readerFocus(), "heading Linked work"],
			status: [navigationStatus(), { state: "normal", text: "" }],
		});
	},
);

screenStory.it(
	"going Back returns focus to the link in the document text that opened the next page",
	[readingPage(documents, "/notes/first.md")],
	function* ({ focusPlace, followDocumentLink, goBack, readerFocus, shownPage }) {
		yield* followDocumentLink("Next");
		expect(yield* shownPage()).toBe("Next");

		yield* goBack();

		yield* outcomes({
			focus: [readerFocus(), "link Next"],
			page: [shownPage(), "First"],
			place: [focusPlace(), "the document text"],
		});
	},
);

screenStory.it(
	"moving from a plain document to a record gives the item context its tabs with Details selected",
	[readingPage(documents, "/notes/plain.md")],
	function* ({ itemContextTabs, navigateTo }) {
		expect(yield* itemContextTabs()).toBe("no tabs");

		yield* navigateTo("/notes/record.md");

		expect(yield* itemContextTabs()).toEqual({ selected: "Details", tabs: ["Details", "Source"] });
	},
);

screenStory.it("a record's empty Details panel stays out of the Tab order", [readingPage(documents, "/notes/record.md")], function* ({ tabStopsIn }) {
	expect(yield* tabStopsIn("Item context")).toEqual(["tab Details"]);
});
