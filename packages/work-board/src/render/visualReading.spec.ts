import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { boardOf } from "#render/board.ts";
import { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { entriesOf } from "#search/entries.ts";

function render(source: string) {
	return Effect.runPromise(renderMarkdown(source, { file: "nested/home.md" }).pipe(Effect.provide(Highlighter.layer)));
}
function progress(attributes: string) {
	return `:::progress${attributes}\nBrowser checks recorded\n\nSource: [Reading checks](../checks.md)\n:::\n`;
}

describe("visual document directives", () => {
	it("renders sourced values and a native labeled progress bar without JavaScript", async () => {
		const html = await render(progress('{completed="3" total="8"}'));
		expect(html).toContain('class="visual-document visual-progress"');
		expect(html).toContain('value="3"');
		expect(html).toContain('max="8"');
		expect(html).toContain("Recorded tally: 3 of 8");
		expect(html).toContain('aria-label="Browser checks recorded: Recorded tally: 3 of 8"');
		expect(html).toContain('href="/checks.md"');
	});

	it.each(['{completed="unknown" total="8"}', '{total="8"}', '{completed="0" total="0"}', "{}"])(
		"keeps incomplete or zero-total tallies explicit (%s)",
		async (attributes) => {
			const html = await render(progress(attributes));
			expect(html).toContain("Percentage unavailable.");
			expect(html).not.toContain("<progress");
			if (attributes !== '{completed="0" total="0"}') {
				expect(html).toContain("Not recorded");
			}
		},
	);

	it.each([
		'{completed="9" total="8"}',
		'{completed="-1" total="8"}',
		'{completed="0.5" total="8"}',
		'{completed="Infinity" total="8"}',
		'{completed="" total="8"}',
		'{completed="   " total="8"}',
		'{completed="3" total="8" execute="true"}',
	])("shows the original source for invalid progress (%s)", async (attributes) => {
		const html = await render(`${progress(attributes)}\nAfter the component.\n`);
		expect(html).toContain("Visual component could not be rendered:");
		expect(html).toContain(":::progress");
		expect(html).not.toContain("<progress");
		expect(html).toContain("After the component.");
	});

	it("requires provenance and keeps unknown metrics distinct from zero", async () => {
		const html = await render(
			':::metric{value="unknown" unit="seconds"}\nReader orientation\n\nSource: [Study](../study.md)\n:::\n\n:::metric{value="0" unit="documents"}\nDocuments measured\n\nSource: [Study](../study.md)\n:::\n',
		);
		expect(html).toContain("Not recorded");
		expect(html).toContain("0 documents");
		const missing = await render(':::metric{value="50" unit="documents"}\nFixture target\n:::');
		expect(missing).toContain("Name a source");
		expect(missing).toContain(":::metric");
	});

	it("keeps timeline authorship, Markdown and sources without scheduling inference", async () => {
		const html = await render(
			":::timeline\nReading delivery\n\n1. **Later · planned:** [Review](../checks.md) with a reader.\n2. **Earlier · recorded:** [Native reads](../checks.md) shipped.\n:::",
		);
		expect(html).toContain('class="visual-timeline-entries"');
		expect(html.indexOf("Later · planned")).toBeLessThan(html.indexOf("Earlier · recorded"));
		expect(html).toContain("<strong>Later · planned:</strong>");
		const broken = await render(":::timeline\nDelivery\n\n1. Unattributed assertion.\n:::");
		expect(broken).toContain("Each timeline entry needs text and a source link");
	});

	it("keeps directives inside legacy cards intact and indexes their visible values and sources", async () => {
		const source = `# Board\n\n## Open\n\n### Task\n\n${progress('{completed="3" total="8"}')}\n## Closed\n`;
		expect(boardOf(source).sections[0]?.items[0]).toContain(":::progress");
		const links = new Set<string>();
		const entries = await entriesOf(source, "board.md", true, 1, links);
		expect(entries.some((entry) => entry.text.includes("Recorded tally: 3 of 8"))).toBe(true);
		expect(links.has("../checks.md")).toBe(true);
		expect(
			boardOf("# Board\n\n:::timeline\nDelivery\n\n## Inside visual\n\n1. [Source](checks.md)\n:::\n\n## Open\n").sections.map(
				(section) => section.title,
			),
		).toEqual(["Open"]);
	});

	it("keeps unsupported directives readable and renders standard GitHub callouts", async () => {
		const html = await render(
			":::unknown\nReadable original.\n:::\n\n> [!NOTE]\n> Recorded evidence is separate from acceptance.\n\n> [!UNRECOGNIZED]\n> Keep this quote.",
		);
		expect(html).toContain(":::unknown");
		expect(html).toContain('class="visual-callout visual-note"');
		expect(html).toContain("Recorded evidence is separate from acceptance.");
		expect(html).toContain("[!UNRECOGNIZED]");
	});
	it("keeps oversized and nested visual sources intact without dropping later content", async () => {
		const oversized = `:::metric{value="1" unit="documents"}\nLabel\n\n${"x".repeat(65_536)}\n\nSource: [Checks](../checks.md)\n:::\n`;
		const html = await render(`${oversized}\nAfter oversized.`);
		expect(html).toContain("exceeds 64 KiB");
		expect(html).toContain("After oversized.");
		const nested = await render(
			'::::progress{completed="1" total="1"}\nOuter\n\n:::metric{value="1" unit="documents"}\nInner\n\nSource: [Checks](../checks.md)\n:::\n\nSource: [Checks](../checks.md)\n::::\n',
		);
		expect(nested).toContain("Nested visual directives are not supported");
		expect(nested).toContain("::::progress");
		expect(nested).not.toContain("<progress");
	});
	it.each(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"])("renders the standard %s callout while preserving its Markdown links", async (kind) => {
		const html = await render(`> [!${kind}]\n> See [evidence](../checks.md).`);
		expect(html).toContain(`class="visual-callout visual-${kind.toLowerCase()}"`);
		expect(html).toContain('href="/checks.md"');
		expect(html).not.toContain(`[!${kind}]`);
	});

	it("retains inline and leaf directive source and renders a later valid component", async () => {
		const html = await render(
			`Inline :metric[value]{unit="seconds"} stays readable.\n\n::metric[Leaf]{value="1" unit="seconds"}\n\n${progress('{completed="3" total="8"}')}`,
		);
		expect(html).toContain(":metric[value]");
		expect(html).toContain("::metric[Leaf]");
		expect(html).toContain("Use a ::: container directive.");
		expect(html).toContain("<progress");
		expect(html).toContain("Recorded tally: 3 of 8");
	});

	it("keeps oversized timelines as source rather than presenting a partial chronology", async () => {
		const entries = Array.from({ length: 101 }, (_, index) => `${index + 1}. Entry ${index} [Source](../checks.md)`).join("\n");
		const html = await render(`:::timeline\nDelivery\n\n${entries}\n:::\n\nAfter the timeline.`);
		expect(html).toContain("1–100 entries");
		expect(html).toContain("Entry 100");
		expect(html).toContain("After the timeline.");
		expect(html).not.toContain('class="visual-timeline-entries"');
	});
});
