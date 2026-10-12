import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { boardHtml } from "#server/page/boardHtml.ts";
import { readingTools } from "#server/page/readingTools.ts";
import { boardOf } from "#server/render/board.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";

it.live("uses the escaped source filename when a home board has no authored top-level title", function* () {
	const html = yield* boardHtml(boardOf("## Review\n\n### Item\n\nRead this."), "notes & review.md", 0).pipe(Effect.provide(Highlighter.layer));
	expect(html).toContain("<h1>notes &amp; review.md</h1>");
	expect(html).toContain("Read this.");
});

it.live("keeps an authored empty heading navigable from the document outline", function* () {
	const headings = documentHeadings();
	yield* renderMarkdown("##\n", { headings }).pipe(Effect.provide(Highlighter.layer));
	expect(readingTools(headings.entries)).toContain('<a href="#heading-section">Section</a>');
});
