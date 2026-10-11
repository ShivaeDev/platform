import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Highlighter } from "./Highlighter.ts";
import { renderMarkdown } from "./markdown.ts";

it.live("resolves source-relative links with encoded filenames and leaves fragments and external links intact", function* () {
	const html = yield* renderMarkdown(
		"[Evidence](../evidence/c%23%20%26%20more%3F.md#proof)\n\n[Local](./decision.md?mode=read#result)\n\n[Passage](#authored)\n\n[External](https://example.com/docs)\n\n[Mail](mailto:review@example.com)",
		{ file: "plans/home & review.md" },
	).pipe(Effect.provide(Highlighter.layer));
	expect(html).toContain('href="/evidence/c%23%20%26%20more%3F.md#proof"');
	expect(html).toContain('href="/plans/decision.md?mode=read#result"');
	expect(html).toContain('href="#authored"');
	expect(html).toContain('href="https://example.com/docs"');
	expect(html).toContain('href="mailto:review@example.com"');
});
