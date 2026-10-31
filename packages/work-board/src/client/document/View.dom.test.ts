import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { documentData } from "#test/documentRendering.ts";
import { serverMarkup } from "#test/documentScreens.ts";
import { documentSource } from "#test/documentSource.ts";
import { gatedDiagrams } from "#test/screenDiagrams.ts";
import { screenStory } from "#test/screenStory.ts";
import { documentScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const ANSWER_CARD = "/_board/item/investigation.choices/#answer-card-direction";
const questionActions = { "/checks": ANSWER_CARD, "/display": ANSWER_CARD };
const readingView = [gatedDiagrams(), documentScreen({ ...documentData(documentSource), questionActions }, "reading-")];
const besideServer = [
	gatedDiagrams(),
	serverMarkup(documentSource, questionActions),
	documentScreen({ ...documentData(documentSource), links: {}, questionActions }),
];

for (const selector of [
	"h1",
	"h2",
	"table",
	"ul.contains-task-list",
	"section.footnotes",
	".questionnaire-reading",
	".visual-document",
	".visual-callout",
	"details",
	".shiki",
	"img",
]) {
	screenStory.it(`the client renders ${selector} exactly as the server's Markdown does`, besideServer, function* ({ renderedBesideServer }) {
		const { client, server } = yield* renderedBesideServer(selector);

		expect(server).not.toEqual([]);
		expect(client).toEqual(server);
	});
}

screenStory.it("the client shows the same diagram source as the server", besideServer, function* ({ textBesideServer }) {
	const { client, server } = yield* textBesideServer(".diagram-source");

	expect(client).toBe(server);
});

screenStory.it("a document opened with an id prefix scopes its footnote links to that prefix", readingView, function* ({ footnotes }) {
	expect(yield* footnotes()).toEqual([{ note: expect.stringContaining("Read the source"), target: "#reading-user-content-fn-source" }]);
});

screenStory.it("a relative link follows the target the document read resolved for it", readingView, function* ({ linkTargets }) {
	expect(yield* linkTargets("affected work")).toEqual(["/resolved-task.md"]);
});

screenStory.it("each question's answer link points at the answer card its question action names", readingView, function* ({ answerLinks }) {
	expect(yield* answerLinks()).toEqual([ANSWER_CARD]);
});

screenStory.it(
	"replacing the document's source gives each new heading one self-link and a unique id",
	[documentScreen(documentData("# Original"))],
	function* ({ headingLinks, refreshDocumentSource }) {
		expect(yield* headingLinks()).toEqual([{ id: "heading-original", links: ["#heading-original"] }]);

		yield* refreshDocumentSource(documentData("# Changed\n\n# Changed"));

		expect(yield* headingLinks()).toEqual([
			{ id: "heading-changed", links: ["#heading-changed"] },
			{ id: "heading-changed-2", links: ["#heading-changed-2"] },
		]);
	},
);

const DETAILS = "# Details\n\n<details><summary>More</summary>First.</details>\n\n<details><summary>More</summary>Second.</details>\n";

screenStory.it(
	"an open details block stays open when another block with the same summary is inserted before it",
	[documentScreen(documentData(DETAILS))],
	function* ({ detailsStates, readerOpensDetails, refreshDocumentSource }) {
		yield* readerOpensDetails(1);
		expect(yield* detailsStates()).toEqual(["MoreFirst.: closed", "MoreSecond.: open"]);

		yield* refreshDocumentSource(documentData(DETAILS.replace("# Details", "# Details\n\n<details><summary>More</summary>Zero.</details>")));

		expect(yield* detailsStates()).toEqual(["MoreZero.: closed", "MoreFirst.: closed", "MoreSecond.: open"]);
	},
);
