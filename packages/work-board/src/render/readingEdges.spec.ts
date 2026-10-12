import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { TEXT_QUESTION } from "#test/coverageEdges.ts";

function render(source: string) {
	return renderMarkdown(source, { file: "item.md", headings: documentHeadings() }).pipe(Effect.provide(Highlighter.layer));
}

it.live("keeps unrecognized fenced languages readable without guessing a highlighter", function* () {
	const html = yield* render("```consumer-specific-language\nvalue < limit\n```\n");
	expect(html).toContain("value &lt; limit");
	expect(html).toContain('class="language-consumer-specific-language"');
	expect(html).not.toContain("shiki-themes");
});

it.live("renders an empty authored heading with a usable labeled section anchor", function* () {
	const html = yield* render("##\n");
	expect(html).toContain('aria-label="Link to section"');
	expect(html).toContain('href="#heading-section"');
});

it.live("renders questionnaire source as reading sections on ordinary document pages", function* () {
	const html = yield* render(TEXT_QUESTION);
	expect(html).toContain('class="questionnaire-reading questionnaire-question"');
	expect(html).toContain("What should happen next?");
});

it.live("discloses a visual component missing its required label instead of inventing one", function* () {
	const html = yield* render(':::metric{value="1" unit="documents"}\nSource: [Checks](checks.md)\n:::\n');
	expect(html).toContain("Start with a Markdown label paragraph.");
	expect(html).toContain(":::metric");
	expect(html).not.toContain('class="visual-document visual-metric"');
});

it.live("accepts an authored reference-style source link as visual provenance", function* () {
	const html = yield* render(':::metric{value="1" unit="documents"}\nReviewed files\n\nSource: [Checks][checks]\n:::\n\n[checks]: checks.md\n');
	expect(html).toContain('class="visual-document visual-metric"');
	expect(html).toContain('href="/checks.md"');
	expect(html).not.toContain("Visual component could not be rendered");
});
