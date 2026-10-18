import { expect } from "vitest";
import { boardStory, projectFiles, serverReading } from "#test/boardStory.ts";

boardStory.it(
	"resolves source-relative links with encoded filenames and leaves fragments and external links intact",
	[
		serverReading(),
		projectFiles({
			"plans/home & review.md":
				"[Evidence](../evidence/c%23%20%26%20more%3F.md#proof)\n\n[Local](./decision.md?mode=read#result)\n\n[Passage](#authored)\n\n[External](https://example.com/docs)\n\n[Mail](mailto:review@example.com)",
		}),
	],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("plans/home & review.md");
		expect(html).toContain('href="/evidence/c%23%20%26%20more%3F.md#proof"');
		expect(html).toContain('href="/plans/decision.md?mode=read#result"');
		expect(html).toContain('href="#authored"');
		expect(html).toContain('href="https://example.com/docs"');
		expect(html).toContain('href="mailto:review@example.com"');
	},
);
