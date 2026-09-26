import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { Highlighter } from "../src/render/highlighter.ts";
import { renderMarkdown } from "../src/render/markdown.ts";

const render = (source: string) => Effect.runPromise(renderMarkdown(source).pipe(Effect.provide(Highlighter.layer)));

describe("markdown rendering", () => {
	it("renders GitHub tables and task lists", async () => {
		const html = await render("| Page | State |\n| --- | --- |\n| docs | open |\n\n- [x] shipped\n- [ ] pending\n");
		expect(html).toContain("<th>Page</th>");
		expect(html).toContain("<td>open</td>");
		expect(html).toContain('<input type="checkbox" checked disabled> shipped');
		expect(html).toContain('<input type="checkbox" disabled> pending');
	});

	it("renders footnotes", async () => {
		const html = await render("A claim.[^source]\n\n[^source]: The source.\n");
		expect(html).toContain('<a href="#user-content-fn-source"');
		expect(html).toContain("The source.");
	});

	it("keeps raw HTML and renders the markdown inside it", async () => {
		const html = await render("<details>\n<summary>Steps</summary>\n\n1. Open `settings`.\n\n</details>\n");
		expect(html).toContain("<details>\n<summary>Steps</summary>");
		expect(html).toContain("<li>Open <code>settings</code>.</li>");
	});

	it("highlights fenced code for the light and the dark colour scheme", async () => {
		const html = await render("```ts\nconst answer = 42\n```\n");
		expect(html).toContain('<pre class="shiki shiki-themes github-light github-dark"');
		expect(html).toContain("--shiki-dark:");
	});

	it("leaves a diagram's source for the browser to draw", async () => {
		const html = await render("```mermaid\ngraph TD; A-->B\n```\n");
		expect(html).toContain('<figure class="diagram" data-state="pending"><pre class="diagram-source">graph TD; A--&gt;B\n</pre></figure>');
	});
});
