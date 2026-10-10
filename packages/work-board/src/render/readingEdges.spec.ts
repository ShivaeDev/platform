import { Effect } from "effect";
import { expect, it } from "vitest";
import { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { TEXT_QUESTION } from "#test/coverageEdges.ts";

function render(source: string) {
	return Effect.runPromise(renderMarkdown(source, { file: "item.md", headings: documentHeadings() }).pipe(Effect.provide(Highlighter.layer)));
}

it("keeps unrecognized fenced languages readable without guessing a highlighter", async () => {
	const html = await render("```consumer-specific-language\nvalue < limit\n```\n");
	expect(html).toContain("value &lt; limit");
	expect(html).toContain('class="language-consumer-specific-language"');
	expect(html).not.toContain("shiki-themes");
});

it("renders an empty authored heading with a usable labeled section anchor", async () => {
	const html = await render("##\n");
	expect(html).toContain('aria-label="Link to section"');
	expect(html).toContain('href="#heading-section"');
});

it("renders questionnaire source as reading sections on ordinary document pages", async () => {
	const html = await render(TEXT_QUESTION);
	expect(html).toContain('class="questionnaire-reading questionnaire-question"');
	expect(html).toContain("What should happen next?");
});

it("discloses a visual component missing its required label instead of inventing one", async () => {
	const html = await render(':::metric{value="1" unit="documents"}\nSource: [Checks](checks.md)\n:::\n');
	expect(html).toContain("Start with a Markdown label paragraph.");
	expect(html).toContain(":::metric");
	expect(html).not.toContain('class="visual-document visual-metric"');
});

it("accepts an authored reference-style source link as visual provenance", async () => {
	const html = await render(':::metric{value="1" unit="documents"}\nReviewed files\n\nSource: [Checks][checks]\n:::\n\n[checks]: checks.md\n');
	expect(html).toContain('class="visual-document visual-metric"');
	expect(html).toContain('href="/checks.md"');
	expect(html).not.toContain("Visual component could not be rendered");
});
