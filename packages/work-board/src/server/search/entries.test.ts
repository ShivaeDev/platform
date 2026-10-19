import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"omits synthetic source lines for board footnotes",
	[projectFiles({ "board.md": "# Plan\n\n[^proof]: Supporting citation.\n\n## Review\n\n### Item\n\nA claim[^proof].\n" }), boardHome("board.md")],
	function* ({ search }) {
		const citations = (yield* search("Supporting citation")).results;
		expect(citations.length).toBeGreaterThan(0);
		expect(citations.every((entry) => entry.line === undefined)).toBe(true);
		expect((yield* search("A claim")).results[0]?.line).toBe(9);
	},
);

for (const home of [false, true]) {
	boardStory.it(
		`links duplicate headings to generated anchors (home ${home})`,
		[
			projectFiles({ "plans/c# & more?.md": "# Plan\n\n## Evidence\n\nA known phrase.\n\n## Evidence\n\nSecond needle." }),
			boardHome(home ? "plans/c# & more?.md" : ""),
		],
		function* ({ search, renderDocument }) {
			const found = yield* search("Second needle");
			expect(found.results[0]?.href).toBe("/plans/c%23%20%26%20more%3F.md#heading-evidence-2");
			expect(yield* renderDocument("plans/c# & more?.md")).toContain('id="heading-evidence-2"');
			expect((yield* search("known phrase")).results[0]?.kind).toBe("passage");
			expect((yield* search("evidence")).results.filter((entry) => entry.kind === "heading")).toHaveLength(2);
		},
	);
}

boardStory.it(
	"searches readable GFM, code, links and Unicode without HTML markup",
	[
		projectFiles({
			"note.md": "# Ελληνικά\n\nA **bold** [phrase](target.md).\n\n## Κώδικας\n\n```ts\nconst needle = 1;\n```\n\n| Value |\n| --- |\n| useful |",
		}),
	],
	function* ({ search }) {
		expect((yield* search("BOLD phrase")).results[0]?.snippet).toContain("bold phrase");
		expect((yield* search("needle")).results[0]?.href).toBe(`/note.md#${encodeURIComponent("heading-κώδικας")}`);
		expect((yield* search("useful")).total).toBeGreaterThan(0);
		expect((yield* search("href")).total).toBe(0);
		expect((yield* search("ελληνικά")).results[0]?.kind).toBe("document");
	},
);

boardStory.it(
	"ranks titles before headings and passages and bounds results after counting",
	[
		projectFiles({
			"needle.md": `# Needle\n\n## Needle section\n\n${Array.from({ length: 50 }, (_, i) => `### Entry ${i}\n\nNeedle ${i} other.`).join("\n\n")}`,
		}),
	],
	function* ({ search }) {
		const found = yield* search("needle");
		expect(found.total).toBe(52);
		expect(found.results).toHaveLength(40);
		expect(found.results.slice(0, 3).map((entry) => entry.kind)).toEqual(["document", "heading", "passage"]);
		expect((yield* search("other 49")).results[0]?.snippet).toBe("Needle 49 other.");
		expect((yield* search("missing")).results).toEqual([]);
		expect((yield* search("  ")).total).toBe(0);
	},
);

boardStory.it(
	"keeps the best block per anchor before limiting and counting results",
	[
		projectFiles({
			"note.md": `# Notes\n\n## Needle\n\n${Array.from({ length: 50 }, (_, i) => `Needle detail ${i}.`).join("\n\n")}\n\n## Other\n\nNeedle elsewhere.`,
		}),
	],
	function* ({ search }) {
		const found = yield* search("needle");
		expect(found.total).toBe(2);
		expect(found.results.map((entry) => entry.kind)).toEqual(["heading", "passage"]);
		expect(found.results.map((entry) => entry.href)).toEqual(["/note.md#heading-needle", "/note.md#heading-other"]);
		expect(found.results[0]?.snippet).toBe("Needle");
	},
);
