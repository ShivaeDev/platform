import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"a citation from a board footnote is found without a source line, while the claim citing it keeps its line",
	[projectFiles({ "board.md": "# Plan\n\n[^proof]: Supporting citation.\n\n## Review\n\n### Item\n\nA claim[^proof].\n" }), boardHome("board.md")],
	function* ({ firstResult, resultLines }) {
		yield* outcomes({
			"citation lines": [resultLines("Supporting citation"), ["no line"]],
			"claim": [firstResult("A claim"), expect.objectContaining({ line: 9 })],
		});
	},
);

const duplicateHeadings = projectFiles({ "plans/c# & more?.md": "# Plan\n\n## Evidence\n\nA known phrase.\n\n## Evidence\n\nSecond needle." });

for (const home of ["", "plans/c# & more?.md"]) {
	boardStory.it(
		`a passage under the second of two equal headings links to its numbered anchor${home ? " on the board home" : ""}`,
		[duplicateHeadings, boardHome(home)],
		function* ({ firstResult, renderedAttributes }) {
			yield* outcomes({
				"rendered heading anchors": [renderedAttributes("plans/c# & more?.md", "h2", "id"), ["heading-evidence", "heading-evidence-2"]],
				"search link": [firstResult("Second needle"), expect.objectContaining({ href: "/plans/c%23%20%26%20more%3F.md#heading-evidence-2" })],
			});
		},
	);
}

boardStory.it("searching a repeated heading name finds both headings", [duplicateHeadings], function* ({ resultKinds }) {
	expect(yield* resultKinds("evidence")).toEqual(["heading", "heading"]);
});

const readable = projectFiles({
	"note.md": "# Ελληνικά\n\nA **bold** [phrase](target.md).\n\n## Κώδικας\n\n```ts\nconst needle = 1;\n```\n\n| Value |\n| --- |\n| useful |",
});

for (const [what, query, found] of [
	["bold link text, ignoring case", "BOLD phrase", { snippet: expect.stringContaining("bold phrase") }],
	["a word in a code block, linked to its Unicode heading", "needle", { href: `/note.md#${encodeURIComponent("heading-κώδικας")}` }],
	["a table cell", "useful", { file: "note.md" }],
	["a Unicode title", "ελληνικά", { kind: "document" }],
] as const) {
	boardStory.it(`search finds ${what}`, [readable], function* ({ firstResult }) {
		expect(yield* firstResult(query)).toMatchObject(found);
	});
}

boardStory.it("search does not find words that exist only in HTML markup", [readable], function* ({ searchTotal }) {
	expect(yield* searchTotal("href")).toBe(0);
});

const manyMatches = projectFiles({
	"needle.md": `# Needle\n\n## Needle section\n\n${Array.from({ length: 50 }, (_, i) => `### Entry ${i}\n\nNeedle ${i} other.`).join("\n\n")}`,
});

boardStory.it("search counts all 52 matches but returns only the best 40", [manyMatches], function* ({ resultCount, searchTotal }) {
	yield* outcomes({
		"matches counted": [searchTotal("needle"), 52],
		"results returned": [resultCount("needle"), 40],
	});
});

boardStory.it("a title match comes before a heading match, and a heading before a passage", [manyMatches], function* ({ resultKinds }) {
	expect((yield* resultKinds("needle")).slice(0, 3)).toEqual(["document", "heading", "passage"]);
});

boardStory.it("the snippet of a passage match is that passage's text", [manyMatches], function* ({ firstResult }) {
	expect(yield* firstResult("other 49")).toMatchObject({ snippet: "Needle 49 other." });
});

for (const query of ["missing", "  "]) {
	boardStory.it(`searching ${JSON.stringify(query)} finds nothing`, [manyMatches], function* ({ searchTotal }) {
		expect(yield* searchTotal(query)).toBe(0);
	});
}

boardStory.it(
	"fifty matching passages under one heading count as one result, linked to that heading with the first passage as snippet",
	[
		projectFiles({
			"note.md": `# Notes\n\n## Needle\n\n${Array.from({ length: 50 }, (_, i) => `Needle detail ${i}.`).join("\n\n")}\n\n## Other\n\nNeedle elsewhere.`,
		}),
	],
	function* ({ searchResults, searchTotal }) {
		yield* outcomes({
			"matches counted": [searchTotal("needle"), 2],
			results: [
				searchResults("needle"),
				[
					expect.objectContaining({ href: "/note.md#heading-needle", kind: "heading", snippet: "Needle detail 0." }),
					expect.objectContaining({ href: "/note.md#heading-other", kind: "passage" }),
				],
			],
		});
	},
);
