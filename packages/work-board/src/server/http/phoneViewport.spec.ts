import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

for (const path of ["/", "/plan.md"]) {
	boardStory.it(
		`the page at ${path} asks phone browsers to resize it above the on-screen keyboard, so answer sheets keep Record in view`,
		[projectFiles({ "plan.md": "# Plan\n" })],
		function* ({ pageShell }) {
			expect(yield* pageShell(path)).toMatchObject({ viewport: "width=device-width, initial-scale=1, interactive-widget=resizes-content" });
		},
	);
}
