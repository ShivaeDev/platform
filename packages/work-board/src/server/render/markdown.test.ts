import { Effect } from "effect";
import { describe, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";

function render(source: string) {
	return renderMarkdown(source).pipe(Effect.provide(Highlighter.layer));
}

describe("markdown rendering", () => {
	it.live("renders GitHub tables and task lists", function* () {
		const html = yield* render("| Page | State |\n| --- | --- |\n| docs | open |\n\n- [x] shipped\n- [ ] pending\n");
		expect(html).toContain("<th>Page</th>");
		expect(html).toContain("<td>open</td>");
		expect(html).toContain('<input type="checkbox" disabled="" checked=""/> shipped');
		expect(html).toContain('<input type="checkbox" disabled=""/> pending');
	});

	it.live("renders footnotes", function* () {
		const html = yield* render("A claim.[^source]\n\n[^source]: The source.\n");
		expect(html).toContain('<a href="#user-content-fn-source"');
		expect(html).toContain("The source.");
	});

	it.live("keeps raw HTML and renders the markdown inside it", function* () {
		const html = yield* render("<details>\n<summary>Steps</summary>\n\n1. Open `settings`.\n\n</details>\n");
		expect(html).toContain("<details>\n<summary>Steps</summary>");
		expect(html).toContain("<li>Open <code>settings</code>.</li>");
	});

	it.live("highlights fenced code for the light and the dark colour scheme", function* () {
		const html = yield* render("```ts\nconst answer = 42\n```\n");
		expect(html).toContain('<pre class="shiki shiki-themes github-dark github-light"');
		expect(html).toContain("--shiki-dark:");
	});

	it.live("leaves a diagram's source for the browser to draw", function* () {
		const html = yield* render("```mermaid\ngraph TD; A-->B\n```\n");
		expect(html).toContain('<figure class="diagram" data-state="pending"><pre class="diagram-source">graph TD; A--&gt;B\n</pre></figure>');
	});

	it.live("uses one GFM renderer for local links, heading anchors and lazy local images", function* () {
		const headings = documentHeadings();
		const html = yield* renderMarkdown("# Review\n\n~~Old~~ [Plan](../plan.md#heading-plan)\n\n![Evidence](../shots/review.png)\n\n## Review\n", {
			file: "nested/home.md",
			headings,
		}).pipe(Effect.provide(Highlighter.layer));
		expect(headings.entries.map((heading) => heading.id)).toEqual(["heading-review", "heading-review-2"]);
		expect(html).toContain("<del>Old</del>");
		expect(html).toContain('href="/plan.md#heading-plan"');
		expect(html).toContain('src="/_board/attachment/shots/review.png"');
		expect(html).toContain('data-local-image="/_board/attachment/shots/review.png"');
		expect(html).toContain('alt="Evidence"');
		expect(html).toContain('loading="lazy"');
		expect(html).not.toContain('rel="preload"');
	});
});
