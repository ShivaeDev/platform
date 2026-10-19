import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const plan = projectFiles({ "plan.md": "# Plan\n" });

boardStory.it(
	"asks phone browsers to fit the page above the on-screen keyboard so answer sheets keep Record in view",
	[plan],
	function* ({ exchange }) {
		for (const path of ["/", "/plan.md"]) {
			const html = (yield* exchange(path)).text;
			expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">');
		}
	},
);
