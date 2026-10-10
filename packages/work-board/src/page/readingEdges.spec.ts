import { Effect } from "effect";
import { expect, it } from "vitest";
import { boardHtml } from "#page/board.ts";
import { readingTools } from "#page/readingTools.ts";
import { boardOf } from "#render/board.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";

it("uses the escaped source filename when a home board has no authored top-level title", async () => {
	const html = await Effect.runPromise(
		boardHtml(boardOf("## Review\n\n### Item\n\nRead this."), "notes & review.md", 0).pipe(Effect.provide(Highlighter.layer)),
	);
	expect(html).toContain("<h1>notes &amp; review.md</h1>");
	expect(html).toContain("Read this.");
});

it("keeps an authored empty heading navigable from the document outline", async () => {
	const headings = documentHeadings();
	await Effect.runPromise(renderMarkdown("##\n", { headings }).pipe(Effect.provide(Highlighter.layer)));
	expect(readingTools(headings.entries)).toContain('<a href="#heading-section">Section</a>');
});
