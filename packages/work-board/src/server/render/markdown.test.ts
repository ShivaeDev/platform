import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const HOME = "nested/home.md";
function home(source: string) {
	return projectFiles({ [HOME]: source });
}

boardStory.it("a GitHub table renders as a table", [home("| Page | State |\n| --- | --- |\n| docs | open |\n")], function* ({ renderedTexts }) {
	yield* outcomes([
		["cells", () => renderedTexts(HOME, "td"), ["docs", "open"]],
		["headers", () => renderedTexts(HOME, "th"), ["Page", "State"]],
	]);
});

boardStory.it(
	"a task list renders read-only checkboxes that show which tasks are done",
	[home("- [x] shipped\n- [ ] pending\n")],
	function* ({ renderedElements, renderedTexts }) {
		yield* outcomes([
			[
				"checkboxes",
				() => renderedElements(HOME, "li input"),
				[
					{ checked: "", disabled: "", type: "checkbox" },
					{ disabled: "", type: "checkbox" },
				],
			],
			["tasks", () => renderedTexts(HOME, "li"), ["shipped", "pending"]],
		]);
	},
);

boardStory.it(
	"a footnote reference links to its footnote text",
	[home("A claim.[^source]\n\n[^source]: The source.\n")],
	function* ({ renderedAttributes, renderedText }) {
		yield* outcomes([
			["footnote reference", () => renderedAttributes(HOME, "sup a", "href"), ["#user-content-fn-source"]],
			["page text", () => renderedText(HOME), expect.stringContaining("The source.")],
		]);
	},
);

boardStory.it(
	"raw HTML is kept and Markdown inside it is rendered",
	[home("<details>\n<summary>Steps</summary>\n\n1. Open `settings`.\n\n</details>\n")],
	function* ({ renderedTexts }) {
		yield* outcomes([
			["code inside", () => renderedTexts(HOME, "details li code"), ["settings"]],
			["summary", () => renderedTexts(HOME, "details summary"), ["Steps"]],
		]);
	},
);

boardStory.it(
	"fenced code is highlighted for both the light and the dark colour scheme",
	[home("```ts\nconst answer = 42\n```\n")],
	function* ({ renderedAttributes }) {
		yield* outcomes([
			["code block", () => renderedAttributes(HOME, "pre", "class"), ["shiki shiki-themes github-dark github-light"]],
			[
				"token styles",
				() => renderedAttributes(HOME, "pre span[style]", "style"),
				expect.arrayContaining([expect.stringContaining("--shiki-dark:")]),
			],
		]);
	},
);

boardStory.it(
	"a diagram's source is left for the browser to draw",
	[home("```mermaid\ngraph TD; A-->B\n```\n")],
	function* ({ renderedAttributes, renderedTexts }) {
		yield* outcomes([
			["diagram source", () => renderedTexts(HOME, "figure.diagram pre.diagram-source"), ["graph TD; A-->B"]],
			["diagram state", () => renderedAttributes(HOME, "figure.diagram", "data-state"), ["pending"]],
		]);
	},
);

const review = home("# Review\n\n~~Old~~ [Plan](../plan.md#heading-plan)\n\n![Evidence](../shots/review.png)\n\n## Review\n");

boardStory.it(
	"GitHub Markdown renders strikethrough, root-relative local links and numbered heading anchors",
	[review],
	function* ({ renderedAttributes, renderedTexts }) {
		yield* outcomes([
			["heading anchors", () => renderedAttributes(HOME, "h1, h2", "id"), ["heading-review", "heading-review-2"]],
			["links", () => renderedAttributes(HOME, "p a", "href"), ["/plan.md#heading-plan"]],
			["strikethrough", () => renderedTexts(HOME, "del"), ["Old"]],
		]);
	},
);

boardStory.it("a local image loads lazily through the attachment route without a preload", [review], function* ({ renderedElements }) {
	yield* outcomes([
		[
			"images",
			() => renderedElements(HOME, "img"),
			[
				expect.objectContaining({
					alt: "Evidence",
					"data-local-image": "/_board/attachment/shots/review.png",
					loading: "lazy",
					src: "/_board/attachment/shots/review.png",
				}),
			],
		],
		["preloads", () => renderedElements(HOME, "link[rel='preload']"), []],
	]);
});
