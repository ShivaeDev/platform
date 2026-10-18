import { describe, expect } from "vitest";
import { boardStory, projectFiles, serverReading } from "#test/boardStory.ts";

describe("markdown rendering", () => {
	boardStory.it(
		"renders GitHub tables and task lists",
		[serverReading(), projectFiles({ "nested/home.md": "| Page | State |\n| --- | --- |\n| docs | open |\n\n- [x] shipped\n- [ ] pending\n" })],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain("<th>Page</th>");
			expect(html).toContain("<td>open</td>");
			expect(html).toContain('<input type="checkbox" disabled="" checked=""/> shipped');
			expect(html).toContain('<input type="checkbox" disabled=""/> pending');
		},
	);

	boardStory.it(
		"renders footnotes",
		[serverReading(), projectFiles({ "nested/home.md": "A claim.[^source]\n\n[^source]: The source.\n" })],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain('<a href="#user-content-fn-source"');
			expect(html).toContain("The source.");
		},
	);

	boardStory.it(
		"keeps raw HTML and renders the markdown inside it",
		[serverReading(), projectFiles({ "nested/home.md": "<details>\n<summary>Steps</summary>\n\n1. Open `settings`.\n\n</details>\n" })],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain("<details>\n<summary>Steps</summary>");
			expect(html).toContain("<li>Open <code>settings</code>.</li>");
		},
	);

	boardStory.it(
		"highlights fenced code for the light and the dark colour scheme",
		[serverReading(), projectFiles({ "nested/home.md": "```ts\nconst answer = 42\n```\n" })],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain('<pre class="shiki shiki-themes github-dark github-light"');
			expect(html).toContain("--shiki-dark:");
		},
	);

	boardStory.it(
		"leaves a diagram's source for the browser to draw",
		[serverReading(), projectFiles({ "nested/home.md": "```mermaid\ngraph TD; A-->B\n```\n" })],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain('<figure class="diagram" data-state="pending"><pre class="diagram-source">graph TD; A--&gt;B\n</pre></figure>');
		},
	);

	boardStory.it(
		"uses one GFM renderer for local links, heading anchors and lazy local images",
		[
			serverReading(),
			projectFiles({ "nested/home.md": "# Review\n\n~~Old~~ [Plan](../plan.md#heading-plan)\n\n![Evidence](../shots/review.png)\n\n## Review\n" }),
		],
		function* ({ renderDocument }) {
			const html = yield* renderDocument("nested/home.md");
			expect(html).toContain('id="heading-review"');
			expect(html).toContain('id="heading-review-2"');
			expect(html).toContain("<del>Old</del>");
			expect(html).toContain('href="/plan.md#heading-plan"');
			expect(html).toContain('src="/_board/attachment/shots/review.png"');
			expect(html).toContain('data-local-image="/_board/attachment/shots/review.png"');
			expect(html).toContain('alt="Evidence"');
			expect(html).toContain('loading="lazy"');
			expect(html).not.toContain('rel="preload"');
		},
	);
});
