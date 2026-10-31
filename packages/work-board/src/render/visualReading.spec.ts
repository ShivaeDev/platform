import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { VISUAL_HOME, visualHome, visualProgress } from "#test/visualProgress.ts";

boardStory.it(
	"a progress tally renders a native labelled progress bar with its value and source, without JavaScript",
	[visualHome(visualProgress('{completed="3" total="8"}'))],
	function* ({ renderedAttributes, renderedElements, renderedTexts }) {
		yield* outcomes({
			"progress bars": [renderedElements(VISUAL_HOME, "progress"), [expect.objectContaining({ max: "8", value: "3" })]],
			"progress label": [
				renderedAttributes(VISUAL_HOME, "[aria-label^='Browser checks']", "aria-label"),
				["Browser checks recorded", "Browser checks recorded: Recorded tally: 3 of 8"],
			],
			"source links": [renderedAttributes(VISUAL_HOME, ".visual-progress a", "href"), ["/checks.md"]],
			tally: [renderedTexts(VISUAL_HOME, ".visual-progress"), [expect.stringContaining("Recorded tally: 3 of 8")]],
		});
	},
);

for (const [attributes, text] of [
	['{completed="unknown" total="8"}', expect.not.stringMatching(/Percentage unavailable\.|Not recorded/u)],
	['{total="8"}', expect.not.stringMatching(/Percentage unavailable\.|Not recorded/u)],
	["{}", expect.not.stringMatching(/Percentage unavailable\.|Not recorded/u)],
	['{completed="0" total="0"}', expect.not.stringContaining("Percentage unavailable.")],
] as const) {
	boardStory.it(
		`a tally of ${attributes} draws no progress bar`,
		[visualHome(visualProgress(attributes))],
		function* ({ renderedText, renderedTexts }) {
			yield* outcomes({
				"page text": [renderedText(VISUAL_HOME), text],
				"progress bars": [renderedTexts(VISUAL_HOME, "progress"), []],
			});
		},
	);
}

for (const attributes of [
	'{completed="9" total="8"}',
	'{completed="-1" total="8"}',
	'{completed="0.5" total="8"}',
	'{completed="Infinity" total="8"}',
	'{completed="" total="8"}',
	'{completed="   " total="8"}',
	'{completed="3" total="8" execute="true"}',
]) {
	boardStory.it(
		`invalid progress ${attributes} shows its original source and the content after it`,
		[visualHome(`${visualProgress(attributes)}\nAfter the component.\n`)],
		function* ({ renderedText, renderedTexts }) {
			yield* outcomes({
				"page text": [
					renderedText(VISUAL_HOME),
					expect.stringMatching(/Visual component could not be rendered:.*:::progress.*After the component\./u),
				],
				"progress bars": [renderedTexts(VISUAL_HOME, "progress"), []],
			});
		},
	);
}

boardStory.it(
	"an unknown metric value stays distinct from a zero value",
	[
		visualHome(
			':::metric{value="unknown" unit="seconds"}\nReader orientation\n\nSource: [Study](../study.md)\n:::\n\n:::metric{value="0" unit="documents"}\nDocuments measured\n\nSource: [Study](../study.md)\n:::\n',
		),
	],
	function* ({ renderedTexts }) {
		expect(yield* renderedTexts(VISUAL_HOME, ".visual-metric")).toEqual([
			"Reader orientation Source: Study",
			"Documents measured 0 documents Source: Study",
		]);
	},
);

boardStory.it(
	"a metric without a source asks for one and keeps its source",
	[visualHome(':::metric{value="50" unit="documents"}\nFixture target\n:::')],
	function* ({ renderedText }) {
		expect(yield* renderedText(VISUAL_HOME)).toEqual(expect.stringMatching(/Name a source.*:::metric/u));
	},
);

boardStory.it(
	"a timeline keeps its authored order, emphasis and links without reordering by date",
	[
		visualHome(
			":::timeline\nReading delivery\n\n1. **Later · planned:** [Review](../checks.md) with a reader.\n2. **Earlier · recorded:** [Native reads](../checks.md) shipped.\n:::",
		),
	],
	function* ({ renderedTexts }) {
		yield* outcomes({
			emphasis: [renderedTexts(VISUAL_HOME, ".visual-timeline-entries strong"), ["Later · planned:", "Earlier · recorded:"]],
			entries: [
				renderedTexts(VISUAL_HOME, ".visual-timeline-entries li"),
				["Later · planned: Review with a reader.", "Earlier · recorded: Native reads shipped."],
			],
		});
	},
);

boardStory.it(
	"a timeline entry without a source asks for text and a source link",
	[visualHome(":::timeline\nDelivery\n\n1. Unattributed assertion.\n:::")],
	function* ({ renderedText }) {
		expect(yield* renderedText(VISUAL_HOME)).toContain("Each timeline entry needs text and a source link");
	},
);

boardStory.it(
	"a progress tally on a heading-board card counts as a card, is searchable and links back from its source",
	[
		boardHome(VISUAL_HOME),
		projectFiles({
			"checks.md": "# Checks",
			[VISUAL_HOME]: `# Board\n\n## Open\n\n### Task\n\n${visualProgress('{completed="3" total="8"}')}\n## Closed\n`,
		}),
	],
	function* ({ boardColumns, documentBacklinks, firstResult }) {
		yield* outcomes({
			"board columns": [boardColumns(VISUAL_HOME), ["Open: 1"]],
			"checks backlinks": [documentBacklinks("checks.md"), ["/nested/home.md"]],
			"search result": [firstResult("Recorded tally"), expect.objectContaining({ text: expect.stringContaining("Recorded tally: 3 of 8") })],
		});
	},
);

boardStory.it(
	"a heading inside a visual is not a board column",
	[
		visualHome(
			"# Board\n\n:::timeline\nDelivery\n\n## Inside visual\n\n### Visual entry\n\n1. [Source](checks.md)\n:::\n\n## Open\n\n### Real card\n",
		),
	],
	function* ({ boardColumns }) {
		expect(yield* boardColumns(VISUAL_HOME)).toEqual(["Open: 1"]);
	},
);

boardStory.it(
	"an unsupported directive stays readable as its source",
	[visualHome(":::unknown\nReadable original.\n:::")],
	function* ({ renderedText }) {
		expect(yield* renderedText(VISUAL_HOME)).toEqual(expect.stringMatching(/:::unknown.*Readable original\./u));
	},
);

boardStory.it(
	"a quote with an unrecognised callout marker stays a plain quote",
	[visualHome("> [!UNRECOGNIZED]\n> Keep this quote.")],
	function* ({ renderedTexts }) {
		yield* outcomes({
			callouts: [renderedTexts(VISUAL_HOME, "[class*='visual-callout']"), []],
			quotes: [renderedTexts(VISUAL_HOME, "blockquote"), ["[!UNRECOGNIZED] Keep this quote."]],
		});
	},
);

for (const kind of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
	boardStory.it(
		`a ${kind} callout renders as a callout and keeps its Markdown link`,
		[visualHome(`> [!${kind}]\n> See [evidence](../checks.md).`)],
		function* ({ renderedAttributes, renderedText }) {
			yield* outcomes({
				"callout classes": [renderedAttributes(VISUAL_HOME, "[class*='visual-callout']", "class"), [`visual-callout visual-${kind.toLowerCase()}`]],
				links: [renderedAttributes(VISUAL_HOME, "a", "href"), ["/checks.md"]],
				"page text": [renderedText(VISUAL_HOME), expect.not.stringContaining(`[!${kind}]`)],
			});
		},
	);
}

boardStory.it(
	"a visual over 64 KiB shows its source with the reason and the content after it",
	[visualHome(`:::metric{value="1" unit="documents"}\nLabel\n\n${"x".repeat(65_536)}\n\nSource: [Checks](../checks.md)\n:::\n\nAfter oversized.`)],
	function* ({ renderedText }) {
		expect(yield* renderedText(VISUAL_HOME)).toEqual(expect.stringMatching(/exceeds 64 KiB.*After oversized\./u));
	},
);

boardStory.it(
	"a visual nested in another shows the outer source with the reason and draws no progress bar",
	[
		visualHome(
			'::::progress{completed="1" total="1"}\nOuter\n\n:::metric{value="1" unit="documents"}\nInner\n\nSource: [Checks](../checks.md)\n:::\n\nSource: [Checks](../checks.md)\n::::\n',
		),
	],
	function* ({ renderedText, renderedTexts }) {
		yield* outcomes({
			"page text": [renderedText(VISUAL_HOME), expect.stringMatching(/Nested visual directives are not supported.*::::progress/u)],
			"progress bars": [renderedTexts(VISUAL_HOME, "progress"), []],
		});
	},
);

boardStory.it(
	"inline and leaf directives stay readable with a hint, and a later valid visual still renders",
	[
		visualHome(
			`Inline :metric[value]{unit="seconds"} stays readable.\n\n::metric[Leaf]{value="1" unit="seconds"}\n\n${visualProgress('{completed="3" total="8"}')}`,
		),
	],
	function* ({ renderedText, renderedTexts }) {
		yield* outcomes({
			"page text": [renderedText(VISUAL_HOME), expect.stringMatching(/:metric\[value\].*Use a ::: container directive\..*::metric\[Leaf\]/u)],
			progress: [renderedTexts(VISUAL_HOME, ".visual-progress"), [expect.stringContaining("Recorded tally: 3 of 8")]],
		});
	},
);

boardStory.it(
	"a timeline of 101 entries shows its source with the 1–100 limit instead of a partial chronology",
	[
		visualHome(
			`:::timeline\nDelivery\n\n${Array.from({ length: 101 }, (_, index) => `${index + 1}. Entry ${index} [Source](../checks.md)`).join("\n")}\n:::\n\nAfter the timeline.`,
		),
	],
	function* ({ renderedText, renderedTexts }) {
		yield* outcomes({
			"page text": [renderedText(VISUAL_HOME), expect.stringMatching(/1–100 entries.*Entry 100.*After the timeline\./u)],
			"timeline entries": [renderedTexts(VISUAL_HOME, ".visual-timeline-entries"), []],
		});
	},
);
