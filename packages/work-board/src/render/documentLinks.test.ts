import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"links resolve against the source's folder with encoded file names, while fragments, external and mail links stay as written",
	[
		projectFiles({
			"plans/home & review.md":
				"[Evidence](../evidence/c%23%20%26%20more%3F.md#proof)\n\n[Local](./decision.md?mode=read#result)\n\n[Passage](#authored)\n\n[External](https://example.com/docs)\n\n[Mail](mailto:review@example.com)",
		}),
	],
	function* ({ renderedAttributes }) {
		expect(yield* renderedAttributes("plans/home & review.md", "a", "href")).toEqual([
			"/evidence/c%23%20%26%20more%3F.md#proof",
			"/plans/decision.md?mode=read#result",
			"#authored",
			"https://example.com/docs",
			"mailto:review@example.com",
		]);
	},
);
