import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles, serverReading } from "#test/boardStory.ts";

function progress(attributes: string) {
	return `:::progress${attributes}\nBrowser checks recorded\n\nSource: [Reading checks](../checks.md)\n:::\n`;
}

describe("visual document directives", () => {
	boardStory.it(
		"renders sourced values and a native labeled progress bar without JavaScript",
		[serverReading(), projectFiles({ "nested/home.md": progress('{completed="3" total="8"}') })],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain('class="visual-document visual-progress"');
			expect(html).toContain('value="3"');
			expect(html).toContain('max="8"');
			expect(html).toContain("Recorded tally: 3 of 8");
			expect(html).toContain('aria-label="Browser checks recorded: Recorded tally: 3 of 8"');
			expect(html).toContain('href="/checks.md"');
		},
	);

	for (const attributes of ['{completed="unknown" total="8"}', '{total="8"}', '{completed="0" total="0"}', "{}"]) {
		boardStory.it(
			`keeps incomplete or zero-total tallies explicit (${JSON.stringify(attributes)})`,
			[serverReading(), projectFiles({ "nested/home.md": progress(attributes) })],
			function* ({ renderDocument }) {
				const html = yield* renderDocument("nested/home.md");
				expect(html).not.toContain("Percentage unavailable.");
				expect(html).not.toContain("<progress");
				if (attributes !== '{completed="0" total="0"}') {
					expect(html).not.toContain("Not recorded");
				}
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
			`shows the original source for invalid progress (${JSON.stringify(attributes)})`,
			[serverReading(), projectFiles({ "nested/home.md": `${progress(attributes)}\nAfter the component.\n` })],
			function* ({ renderDocument }) {
				const html = yield* renderDocument("nested/home.md");
				expect(html).toContain("Visual component could not be rendered:");
				expect(html).toContain(":::progress");
				expect(html).not.toContain("<progress");
				expect(html).toContain("After the component.");
			},
		);
	}

	boardStory.it(
		"requires provenance and keeps unknown metrics distinct from zero",
		[
			serverReading(),
			projectFiles({
				"nested/home.md":
					':::metric{value="unknown" unit="seconds"}\nReader orientation\n\nSource: [Study](../study.md)\n:::\n\n:::metric{value="0" unit="documents"}\nDocuments measured\n\nSource: [Study](../study.md)\n:::\n',
			}),
		],
		function* ({ editFile, renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).not.toContain("Not recorded");
			expect(html).toContain("0 documents");
			editFile("nested/home.md", ':::metric{value="50" unit="documents"}\nFixture target\n:::');
			const missing = yield* renderDocument("nested/home.md");
			expect(missing).toContain("Name a source");
			expect(missing).toContain(":::metric");
		},
	);

	boardStory.it(
		"keeps timeline authorship, Markdown and sources without scheduling inference",
		[
			serverReading(),
			projectFiles({
				"nested/home.md":
					":::timeline\nReading delivery\n\n1. **Later · planned:** [Review](../checks.md) with a reader.\n2. **Earlier · recorded:** [Native reads](../checks.md) shipped.\n:::",
			}),
		],
		function* ({ editFile, renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain('class="visual-timeline-entries"');
			expect(html.indexOf("Later · planned")).toBeLessThan(html.indexOf("Earlier · recorded"));
			expect(html).toContain("<strong>Later · planned:</strong>");
			editFile("nested/home.md", ":::timeline\nDelivery\n\n1. Unattributed assertion.\n:::");
			const broken = yield* renderDocument("nested/home.md");
			expect(broken).toContain("Each timeline entry needs text and a source link");
		},
	);

	boardStory.it(
		"indexes visual values and provenance inside heading-board cards",
		[
			serverReading(),
			boardHome("nested/home.md"),
			projectFiles({
				"checks.md": "# Checks",
				"nested/home.md": `# Board\n\n## Open\n\n### Task\n\n${progress('{completed="3" total="8"}')}\n## Closed\n`,
			}),
		],
		function* ({ search, readDocument, readBoard }) {
			expect((yield* readBoard("nested/home.md")).counts).toEqual([{ count: 1, title: "Open" }]);
			expect((yield* search("Recorded tally")).results[0]?.text).toContain("Recorded tally: 3 of 8");
			expect((yield* readDocument("checks.md")).reading?.backlinks).toEqual([expect.objectContaining({ href: "/nested/home.md" })]);
		},
	);

	boardStory.it(
		"keeps a heading inside a visual out of the board columns",
		[
			serverReading(),
			projectFiles({
				"nested/home.md":
					"# Board\n\n:::timeline\nDelivery\n\n## Inside visual\n\n### Visual entry\n\n1. [Source](checks.md)\n:::\n\n## Open\n\n### Real card\n",
			}),
		],
		function* ({ readBoard }) {
			expect((yield* readBoard("nested/home.md")).counts.map((column) => column.title)).toEqual(["Open"]);
		},
	);

	boardStory.it(
		"keeps unsupported directives readable and renders standard GitHub callouts",
		[
			serverReading(),
			projectFiles({
				"nested/home.md":
					":::unknown\nReadable original.\n:::\n\n> [!NOTE]\n> Recorded evidence is separate from acceptance.\n\n> [!UNRECOGNIZED]\n> Keep this quote.",
			}),
		],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain(":::unknown");
			expect(html).toContain('class="visual-callout visual-note"');
			expect(html).toContain("Recorded evidence is separate from acceptance.");
			expect(html).toContain("[!UNRECOGNIZED]");
		},
	);

	boardStory.it(
		"keeps oversized and nested visual sources intact without dropping later content",
		[
			serverReading(),
			projectFiles({
				"nested/home.md": `${`:::metric{value="1" unit="documents"}\nLabel\n\n${"x".repeat(65_536)}\n\nSource: [Checks](../checks.md)\n:::\n`}\nAfter oversized.`,
			}),
		],
		function* ({ editFile, renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain("exceeds 64 KiB");
			expect(html).toContain("After oversized.");
			editFile(
				"nested/home.md",
				'::::progress{completed="1" total="1"}\nOuter\n\n:::metric{value="1" unit="documents"}\nInner\n\nSource: [Checks](../checks.md)\n:::\n\nSource: [Checks](../checks.md)\n::::\n',
			);
			const nested = yield* renderDocument("nested/home.md");
			expect(nested).toContain("Nested visual directives are not supported");
			expect(nested).toContain("::::progress");
			expect(nested).not.toContain("<progress");
		},
	);

	for (const kind of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
		boardStory.it(
			`renders a standard callout while preserving its Markdown links (${JSON.stringify(kind)})`,
			[serverReading(), projectFiles({ "nested/home.md": `> [!${kind}]\n> See [evidence](../checks.md).` })],
			function* ({ renderDocument }) {
				const html = yield* renderDocument("nested/home.md");
				expect(html).toContain(`class="visual-callout visual-${kind.toLowerCase()}"`);
				expect(html).toContain('href="/checks.md"');
				expect(html).not.toContain(`[!${kind}]`);
			},
		);
	}

	boardStory.it(
		"retains inline and leaf directive source and renders a later valid component",
		[
			serverReading(),
			projectFiles({
				"nested/home.md": `Inline :metric[value]{unit="seconds"} stays readable.\n\n::metric[Leaf]{value="1" unit="seconds"}\n\n${progress('{completed="3" total="8"}')}`,
			}),
		],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain(":metric[value]");
			expect(html).toContain("::metric[Leaf]");
			expect(html).toContain("Use a ::: container directive.");
			expect(html).toContain("<progress");
			expect(html).toContain("Recorded tally: 3 of 8");
		},
	);

	boardStory.it(
		"keeps oversized timelines as source rather than presenting a partial chronology",
		[
			serverReading(),
			projectFiles({
				"nested/home.md": `:::timeline\nDelivery\n\n${Array.from({ length: 101 }, (_, index) => `${index + 1}. Entry ${index} [Source](../checks.md)`).join("\n")}\n:::\n\nAfter the timeline.`,
			}),
		],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain("1–100 entries");
			expect(html).toContain("Entry 100");
			expect(html).toContain("After the timeline.");
			expect(html).not.toContain('class="visual-timeline-entries"');
		},
	);
});
