import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { TEXT_QUESTION } from "#test/coverageEdges.ts";

const HOME = "nested/home.md";

boardStory.it(
	"code in an unrecognised fenced language stays readable and is not highlighted",
	[projectFiles({ [HOME]: "```consumer-specific-language\nvalue < limit\n```\n" })],
	function* ({ renderedAttributes, renderedTexts }) {
		yield* outcomes([
			["code", () => renderedTexts(HOME, "pre code"), ["value < limit"]],
			["code language", () => renderedAttributes(HOME, "pre code", "class"), ["language-consumer-specific-language"]],
			["highlighted blocks", () => renderedTexts(HOME, ".shiki"), []],
		]);
	},
);

boardStory.it("an empty heading gets a labelled link to a section anchor", [projectFiles({ [HOME]: "##\n" })], function* ({ renderedAttributes }) {
	expect(yield* renderedAttributes(HOME, "a[aria-label='Link to section']", "href")).toEqual(["#heading-section"]);
});

boardStory.it(
	"a questionnaire on an ordinary document page renders as a reading section with its question",
	[projectFiles({ [HOME]: TEXT_QUESTION })],
	function* ({ renderedTexts }) {
		expect(yield* renderedTexts(HOME, ".questionnaire-reading.questionnaire-question")).toEqual([
			expect.stringContaining("What should happen next?"),
		]);
	},
);

boardStory.it(
	"a metric without its label paragraph shows its source with the reason instead of inventing a label",
	[projectFiles({ [HOME]: ':::metric{value="1" unit="documents"}\nSource: [Checks](checks.md)\n:::\n' })],
	function* ({ renderedText, renderedTexts }) {
		yield* outcomes([
			["metrics", () => renderedTexts(HOME, ".visual-metric"), []],
			["page text", () => renderedText(HOME), expect.stringMatching(/Start with a Markdown label paragraph\..*:::metric/u)],
		]);
	},
);

boardStory.it(
	"a reference-style source link counts as a metric's source",
	[projectFiles({ [HOME]: ':::metric{value="1" unit="documents"}\nReviewed files\n\nSource: [Checks][checks]\n:::\n\n[checks]: checks.md\n' })],
	function* ({ renderedAttributes, renderedText }) {
		yield* outcomes([
			["metric source links", () => renderedAttributes(HOME, ".visual-metric a", "href"), ["/nested/checks.md"]],
			["page text", () => renderedText(HOME), expect.not.stringContaining("Visual component could not be rendered")],
		]);
	},
);
